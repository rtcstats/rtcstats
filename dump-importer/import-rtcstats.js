import {readRTCStatsDump, createRtcStatsTimeSeries} from 'rtcstats-shared';

import {StatsRatesCalculatorAdapter} from './chromium/stats_rates_calculator_adapter.js';

import {
    createCandidateTable,
    createContainers,
    createGraphAndContainer,
    processDescriptionEvent,
} from './import-common.js';

export class RTCStatsDumpImporter extends EventTarget {
    constructor(container) {
        super();
        this.graphs = {};
        this.container = container;
        this.containers = {};
    }

    async process(blob) {
        this.data = await readRTCStatsDump(blob);
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
        ua.innerText = this.data.userAgent;
        container.appendChild(ua);
        this.container.appendChild(container);

        this.dispatchEvent(new Event('processed-useragent'));
    }
    processGetUserMedia() {
        // no-op for RTCStats.
        this.dispatchEvent(new Event('processed-getusermedia'));
    }
    importUpdatesAndStats() {
        setTimeout(this.processConnections.bind(this), 0, Object.keys(this.data.peerConnections));
    }
    processConnections(connectionIds) {
        const connectionId = connectionIds.shift();
        if (!connectionId) {
            this.processMetadata();
            return;
        }
        setTimeout(this.processStats.bind(this), 0, connectionId);
        setTimeout(this.processConnections.bind(this), 0, connectionIds);

        const peerConnectionTrace = this.data.peerConnections[connectionId];
        const container = createContainers(connectionId, this.data.url, this.containers);
        this.container.appendChild(container);

        this._showCandidateGrid(connectionId);
        this._showStateChanges(connectionId);

        // Process the traces.
        for (const traceEvent of peerConnectionTrace) {
            if (traceEvent.type === 'getStats' && !traceEvent.extra.length) {
                continue;
            }
            const row = this._processTraceEvent(traceEvent);
            if (row) {
                this.containers[connectionId].updateLog.appendChild(row);
            }
        }

        const ev = new Event('processed-peerconnection');
        ev.connectionId = connectionId;
        this.dispatchEvent(ev);
    }

    processStats(connectionId) {
        const peerConnectionTrace = this.data.peerConnections[connectionId];
        // Augment stats with webrtc-internals style calculated values.
        const rateCalculator = new StatsRatesCalculatorAdapter();
        for (const traceEvent of peerConnectionTrace) {
            if (traceEvent.type !== 'getStats') {
                continue;
            }
            const calculatedMetrics = rateCalculator.addGetStats(traceEvent.value);
            Object.keys(calculatedMetrics).forEach(id => {
                Object.assign(traceEvent.value[id], calculatedMetrics[id]);
            });
        }

        // TODO: ideally this would be fully async and this would only create the details
        // while the actual calculations take place later, e.g. when a graph is opened.
        // Create timeseries data from individual getStats data.
        const timeSeries = createRtcStatsTimeSeries(peerConnectionTrace);
        this.graphs[connectionId] = {};
        for (const statsId in timeSeries) {
            const result = createGraphAndContainer(statsId, timeSeries[statsId]);
            if (!result) {
                continue;
            }
            const {graph, container} = result;
            this.graphs[connectionId][statsId] = graph;
            this.containers[connectionId].graphs.appendChild(container);
        }
        if (Object.keys(this.graphs[connectionId]).length === 0) {
            this.containers[connectionId].graphs.style.display = 'none';
        }

        const ev = new Event('processed-stats');
        ev.connectionId = connectionId;
        this.dispatchEvent(ev);
    }

    processMetadata() {
        // RTCStats performance metadata.
        const container = document.createElement('details');
        /*
        container.addEventListener('toggle', (event) => {
        // This entry was opened (see event.newState) so must be interesting?
        });
         */
        container.open = false;
        container.style.margin = '10px';
        const summary = document.createElement('summary');
        summary.innerText = 'RTCStats Metadata';
        container.appendChild(summary);

        const d = document.createElement('div');
        d.id = 'meta_chart_' + Date.now();
        d.classList.add('graph');
        container.appendChild(d);
        this.container.appendChild(container);
        const metadata = new Highcharts.Chart(d, {
            title: {
                text: 'Event size metadata',
            },
            xAxis: {
                type: 'datetime',
            },
            yAxis: {
                min: 0,
            },
            chart: {
                type: 'scatter',
                zoomType: 'x',
            },
            tooltip: {
                formatter: function format() {
                    return `${this.y} -- ${this.method}`;
                }
            },
            series: Object.keys(this.data.eventSizes).map(connection_id => ({
                name: connection_id,
                data: this.data.eventSizes[connection_id],
            })),
        });
        this.metadata = metadata;

        this.dispatchEvent(new Event('processed-metadata'));
    }

    _showCandidateGrid(connectionId) {
        // Show the candidate grid.
        const peerConnectionTrace = this.data.peerConnections[connectionId];
        let show = false;
        for (let i = peerConnectionTrace.length - 1; i >= 0; i--) {
            const traceEvent = peerConnectionTrace[i];
            if (traceEvent.type === 'getStats') {
                createCandidateTable(traceEvent.value, this.containers[connectionId].candidates);
                show = true;
                break;
            }
        }
        if (!show) {
            this.containers[connectionId].candidates.parentElement.style.display = 'none';
        }
    }

    _showStateChanges(connectionId) {
        // Show the state changes.
        const peerConnectionTrace = this.data.peerConnections[connectionId];
        let hadEvent = false;
        for (const traceEvent of peerConnectionTrace) {
            if (traceEvent.type === 'oniceconnectionstatechange') {
                this.containers[connectionId].iceConnectionState.textContent += ' => ' + traceEvent.value;
                hadEvent = true;
            }
            if (traceEvent.type === 'onconnectionstatechange') {
                this.containers[connectionId].connectionState.textContent += ' => ' + traceEvent.value;
                hadEvent = true;
            }
            if (traceEvent.type === 'onsignalingstatechange') {
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

    _processTraceEvent(traceEvent) {
        const date = new Date(traceEvent.timestamp);
        const row = document.createElement('tr');
        let el = document.createElement('td');
        el.setAttribute('nowrap', '');
        el.innerText = date.toLocaleTimeString(); // TODO: make this configurable via settings.
        el.title = date.toISOString().split('T'); // Only way to get milliseconds.
        row.appendChild(el);

        el = document.createElement('td');
        if (traceEvent.value) {
            const details = document.createElement('details');
            /*
            details.addEventListener('toggle', (event) => {
                // This entry was opened (see event.newState) so must be interesting?
            });
            */
            const summary = document.createElement('summary');
            summary.innerText = traceEvent.type;
            details.appendChild(summary);
            const pre = document.createElement('pre');
            if (typeof traceEvent.value === 'object' && traceEvent.value.type && traceEvent.value.sdp) {
                processDescriptionEvent(pre, traceEvent.type, traceEvent.value, undefined, undefined);
            } else if (typeof traceEvent.value === 'string') {
                pre.innerText = traceEvent.value;
            } else {
                pre.innerText = JSON.stringify(traceEvent.value, null, ' ');
            }
            details.appendChild(pre);
            el.appendChild(details);
        } else {
            el.innerText = traceEvent.type;
        }

        row.appendChild(el);

        // TODO: this is visualization which should not be done at this layer.
        // guess what, if the traceEvent type contains 'Failure' one could use css to highlight it
        if (traceEvent.type.indexOf('Failure') !== -1) {
            row.style.backgroundColor = 'red';
        }
        if (['oniceconnectionstatechange', 'onconnectionstatechange'].includes(traceEvent.type)) {
            switch(traceEvent.value) {
            case 'connected':
            case 'completed':
                row.style.backgroundColor = 'green';
                break;
            case 'failed':
                row.style.backgroundColor = 'red';
                break;
            }
        }

        if (traceEvent.type === 'onicecandidate' || traceEvent.type === 'addIceCandidate') {
            if (traceEvent.value && traceEvent.value.candidate) {
                const parts = traceEvent.value.candidate.trim().split(' ');
                if (parts && parts.length >= 9 && parts[7] === 'typ') {
                    details.classList.add(parts[8]);
                }
            }
        }

        // Correlation id et al. Dump into separate columns for now.
        for (const extra of traceEvent.extra) {
            const extraEl = document.createElement('td');
            if (extra !== null) {
                extraEl.innerText = JSON.stringify(extra);
            }
            row.appendChild(extraEl);
        }

        return row;
    }
}
