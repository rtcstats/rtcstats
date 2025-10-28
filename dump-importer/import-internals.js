import {
    createContainers,
    processGetUserMedia,
    createCandidateTable,
    processDescriptionEvent,
    createGraphAndContainer,
} from './import-common.js';
import {
    createInternalsTimeSeries,
    readWebRTCInternalsDump,
} from 'rtcstats-shared';

const SDPUtils = window.adapter.sdp;

export class WebRTCInternalsDumpImporter extends EventTarget {
    constructor(container, options) {
        super();
        this.graphs = {};
        this.container = container;
        this.containers = {};
        this.options = options;
    }

    async process(blob) {
        this.data = await readWebRTCInternalsDump(blob);
        if (!this.data.UserAgentData) { // Added in M138.
            const el = document.createElement('div');
            el.innerHTML = 'Unsupported webrtc-internals dump without UserAgentData (added in M138 mid-2025) detected. ' +
                'Please use the <a href="https://fippo.github.io/webrtc-dump-importer/">old dump-importer</a> instead.';
            document.body.appendChild(el);
            return;
        }
        this.processUserAgent();
        this.processGetUserMedia();
        this.importUpdatesAndStats();
    }

    processUserAgent() {
        const container = document.createElement('div');
        const label = document.createElement('span');
        label.innerText = 'User Agent:';
        container.appendChild(label);

        const ua = document.createElement('span');
        if (this.data.UserAgentData && this.data.UserAgentData.length >= 3) {
            ua.innerText =
                this.data.UserAgentData[2].brand + ' ' +
                this.data.UserAgentData[2].version + ' / ' ;
        }
        ua.innerText += this.data.UserAgent;
        container.appendChild(ua);
        this.container.appendChild(container);

        this.dispatchEvent(new Event('processed-useragent'));
    }

    processGetUserMedia() {
        // FIXME: also display GUM calls (can they be correlated to addStream?)
        processGetUserMedia(this.data.getUserMedia, this.container);

        this.dispatchEvent(new Event('processed-getusermedia'));
    }

    importUpdatesAndStats() {
        for (let connectionId in this.data.PeerConnections) {
            const container = createContainers(connectionId, this.data.PeerConnections[connectionId].url, this.containers);
            this.container.appendChild(container);
        }
        setTimeout(this.processConnections.bind(this), 0, Object.keys(this.data.PeerConnections));
    }

    processConnections(connectionIds) {
        const connectionId = connectionIds.shift();
        if (!connectionId) return;
        setTimeout(this.processStats.bind(this), 0, connectionId);
        setTimeout(this.processConnections.bind(this), 0, connectionIds);

        const peerConnectionTrace = this.data.PeerConnections[connectionId];
        const container = this.containers[connectionId];

        // Display the updateLog
        this.containers[connectionId].url.innerText = 'Origin: ' + peerConnectionTrace.url;
        this.containers[connectionId].configuration.innerText = 'Configuration: ' + JSON.stringify(peerConnectionTrace.rtcConfiguration, null, ' ') + '\n';
        if (peerConnectionTrace.constraints) {
            this.containers[connectionId].configuration.innerText += 'Legacy (chrome) constraints: ' + JSON.stringify(peerConnectionTrace.constraints, null, ' ');
        }

        this._showStateChanges(connectionId);

        const state = {};
        for (const traceEvent of peerConnectionTrace.updateLog) {
            const row = this._processTraceEvent(traceEvent, state);
            if (row) {
                this.containers[connectionId].updateLog.appendChild(row);
            }
            if (traceEvent.type === 'createOfferOnSuccess') {
                state.lastCreatedOffer = traceEvent.value;
            } else if (traceEvent.type === 'createAnswerOnSuccess') {
                state.lastCreatedAnswer = traceEvent.value;
            } else if (traceEvent.type === 'setLocalDescription') {
                state.lastCreatedOffer = undefined;
                state.lastCreatedAnswer = undefined;
            } else if (traceEvent.type === 'setRemoteDescription') {
                state.lastRemoteDescription = traceEvent.value;
            } else if (traceEvent.type === 'signalingstatechange' && traceEvent.value === 'stable') {
                state.lastRemoteDescription = undefined;
            }
        }

        const ev = new Event('processed-peerconnection');
        ev.connectionId = connectionId;
        this.dispatchEvent(ev);
    }

    _showCandidateGrid(connectionId, timeSeries) {
        const lastStats = {};
        for (const statsId in timeSeries) {
            const report = timeSeries[statsId];
            const lastReport = {type: report.type};
            for (const property in report) {
                if (!Array.isArray(report[property])) continue;
                const [key, values] = report[property];
                lastReport[property] = report[property][report[property].length - 1][1];
            }
            lastStats[statsId] = lastReport;
        }
        createCandidateTable(lastStats, this.containers[connectionId].candidates);
    }

    processStats(connectionId) {
        const peerConnectionTrace = this.data.PeerConnections[connectionId];
        const referenceTime = this.options.useReferenceTime && peerConnectionTrace.updateLog.length
            ? peerConnectionTrace.updateLog[0].timestamp || new Date(peerConnectionTrace.updateLog[0].time).getTime()
            : undefined;
        this.graphs[connectionId] = {};

        const timeSeries = createInternalsTimeSeries(peerConnectionTrace);
        this._showCandidateGrid(connectionId, timeSeries);

        for (const statsId in timeSeries) {
            const result = createGraphAndContainer(statsId, timeSeries[statsId], referenceTime);
            if (!result) {
                continue;
            }
            const {graph, container} = result;
            this.graphs[connectionId][statsId] = graph;
            this.containers[connectionId].graphs.appendChild(container);
        }

        const ev = new Event('processed-stats');
        ev.connectionId = connectionId;
        this.dispatchEvent(ev);
    }

    _showStateChanges(connectionId) {
        // update state displays
        const peerConnectionTrace = this.data.PeerConnections[connectionId];
        let hadEvent = false;
        for (const traceEvent of peerConnectionTrace.updateLog) {
            try {
                JSON.parse(traceEvent.value);
            } catch (e) {
                // console.error("FAILED", traceEvent.type, traceEvent.value, e);
            }
            // FIXME: would be cool if a click on this would jump to the table row
            if (traceEvent.type === 'iceconnectionstatechange') {
                this.containers[connectionId].iceConnectionState.textContent += ' => ' + traceEvent.value;
                hadEvent = true;
            } else if (traceEvent.type === 'connectionstatechange') {
                this.containers[connectionId].connectionState.textContent += ' => ' + traceEvent.value;
                hadEvent = true;
            } else if (traceEvent.type === 'signalingstatechange') {
                this.containers[connectionId].signalingState.textContent += ' => ' + traceEvent.value;
                hadEvent = true;
            }
        }
        if (!hadEvent) {
            this.containers[connectionId].iceConnectionState.style.display = 'none';
            this.containers[connectionId].connectionState.style.display = 'none';
            this.containers[connectionId].signalingState.style.display = 'none';
        }
    }

    _processTraceEvent(traceEvent, state) {
        const row = document.createElement('tr');
        let el = document.createElement('td');
        el.setAttribute('nowrap', '');
        el.innerText = traceEvent.timestamp ? new Date(traceEvent.timestamp) : traceEvent.time;
        row.appendChild(el);

        // recreate the HTML of webrtc-internals
        const details = document.createElement('details');
        el = document.createElement('summary');
        el.innerText = traceEvent.type;
        details.appendChild(el);

        if (['іcecandidate', 'addIceCandidate'].includes(traceEvent.type) && traceEvent.value) {
            const toShow = [];
            if (traceEvent.value.startsWith('{')) {
                const parts = JSON.parse(traceEvent.value);
                ['sdpMid', 'sdpMLineIndex'].forEach(property => {
                    toShow.push(property + ': ' + parts[property]);
                });
                if (parts.candidate) {
                    const candidate = SDPUtils.parseCandidate(parts.candidate.trim());
                    if (candidate) {
                        toShow.push('port:' + candidate.port);
                        toShow.push('type: ' + candidate.type);
                    }
                }
                if (parts.relayProtocol) {
                    toShow.push('relayProtocol: ' + parts.relayProtocol);
                }
            } else {
                const parts = traceEvent.value.split(', ')
                    .map(part => part.split(': '));
                parts.forEach(part => {
                    if (['sdpMid', 'sdpMLineIndex'].includes(part[0])) {
                        toShow.push(part.join(': '));
                    } else if (part[0] === 'candidate') {
                        const candidate = SDPUtils.parseCandidate(part[1].trim());
                        if (candidate) {
                            toShow.push('port:' + candidate.port);
                            toShow.push('type: ' + candidate.type);
                        }
                    } else if (part[0] === 'relayProtocol') {
                        toShow.push('relayProtocol: ' + part[1]);
                    }
                });
            }
            el.innerText += ' (' + toShow.join(', ') + ')';
        }

        if (traceEvent.value.startsWith('{"type":') || traceEvent.value.indexOf(', sdp: ') !== -1) {
            let type;
            let sdp;
            if (traceEvent.value.startsWith('{"type":')) {
                const result = JSON.parse(traceEvent.value);
                type = result.type;
                sdp = result.sdp;
            } else { // legacy format.
                const result = traceEvent.value.substr(6).split(', sdp: ');
                type = result[0];
                sdp = result[1];
            }
            let last_sections;
            let remote_sections;
            if (traceEvent.type === 'setLocalDescription') {
                const lastCreated = type === 'offer' ? state.lastCreatedOffer : state.lastCreatedAnswer;
                if ((type === 'offer' && state.lastCreatedOffer) || (type === 'answer' && state.lastCreatedAnswer)) {
                    let last_type;
                    let last_sdp;
                    const lastDescription = (type === 'offer' ? state.lastCreatedOffer : state.lastCreatedAnswer);
                    if (lastDescription.startsWith('{"type":')) {
                        const result = JSON.parse(lastDescription);
                        last_type = result.type;
                        last_sdp = result.sdp;
                    } else {
                        const result = lastDescription.substr(6).split(', sdp: ');
                        last_type = result[0];
                        last_sdp = result[1];
                    }
                    if (sdp !== last_sdp) {
                        last_sections = SDPUtils.splitSections(last_sdp);
                        details.open = true;
                    }
                }
                if (state.remoteDescription) {
                    const [remote_type, remote_sdp] = state.remoteDescription.substr(6).split(', sdp: ');
                    remote_sections = SDPUtils.splitSections(remote_sdp);
                }
            }
            processDescriptionEvent(details, traceEvent.type, {type, sdp}, last_sections, remote_sections);
        } else if (traceEvent.value && traceEvent.value.startsWith('{')) {
            el = document.createElement('pre');
            el.innerText = JSON.stringify(JSON.parse(traceEvent.value), null, ' ');
        } else {
            el = document.createElement('pre');
            el.innerText = traceEvent.value;
        }
        details.appendChild(el);
        el = document.createElement('td');
        if (traceEvent.value !== '') {
            el.appendChild(details);
        } else {
            el.innerText = traceEvent.type;
        }
        row.appendChild(el);

        // If the traceEvent type ends with 'Failure' hightlight it
        if (traceEvent.type.endsWith('Failure')) {
            row.style.backgroundColor = 'red';
        }
        // Likewise, highlight (ice)connectionstates.
        if (['iceconnectionstatechange', 'connectionstatechange'].includes(traceEvent.type)) {
            switch(traceEvent.value) {
            case 'connected': // <M142
            case 'completed': // <M142
            case '"connected"':
            case '"completed"':
                row.style.backgroundColor = 'green';
                break;
            case 'failed': // <M142
            case '"failed"':
                row.style.backgroundColor = 'red';
                break;
            }
        }
        return row;
    }
}

