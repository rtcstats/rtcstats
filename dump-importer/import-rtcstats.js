import {statsDecompression, decompressMethod} from 'rtcstats-shared';

import {StatsRatesCalculatorAdapter} from './chromium/stats_rates_calculator_adapter.js';

import {
    createCandidateTable,
    createContainers,
    createGraphOptions,
    processDescriptionEvent,
} from './import-common.js';

export function decompressRtcStats(lines) {
    // The first line must be a JSON object with metadata.
    const data = JSON.parse(lines.shift());
    data.peerConnections = {};
    data.eventSizes = {};

    const baseStats = {};
    let lastTime = 0;
    for (let line of lines) {
        if (!line.length) {
            continue; // Ignore empty lines.
        }
        const jsonData = JSON.parse(line);
        if (!Array.isArray(jsonData)) {
            continue; // Ignore non-array lines.
        }
        let [method, connection_id, value, ...extra] = jsonData;
        method = decompressMethod(method);

        // TODO: server-side close is currently not a delta.
        lastTime = extra.pop() + lastTime;
        const time = new Date(lastTime);

        // TODO: more explicit handling via create and close?
        if (!data.peerConnections[connection_id]) {
            data.peerConnections[connection_id] = [];
            baseStats[connection_id] = {};
        }
        if (method === 'getStats') { // delta-compressed stats
            value = statsDecompression(baseStats[connection_id], value);
            baseStats[connection_id] = JSON.parse(JSON.stringify(value));
        }
        data.peerConnections[connection_id].push({
            time,
            type: method,
            value,
            extra,
        });

        if (!(connection_id === null && method === 'close')) {
            if (!data.eventSizes[connection_id]) {
                data.eventSizes[connection_id] = [];
            }
            data.eventSizes[connection_id].push({
                x: lastTime,
                y: line.length,
                method,
            });
        }
    }
    return data;
}

function createRtcStatsTimeSeries(trace) {
    const series = {};
    for (let i = 0; i < trace.length; i++) {
        if (trace[i].type !== 'getStats') {
            continue;
        }
        const stats = trace[i].value;
        Object.keys(stats).forEach(id => {
            const report = stats[id];
            Object.keys(report).forEach(name=> {
                if (name === 'timestamp') return;
                if (name === 'type') return;
                if (!series[id]) {
                    series[id] = {};
                    series[id].type = stats[id].type;
                }
                const timeSeries = series[id];
                if (!timeSeries[name]) {
                    timeSeries[name] = [];
                } else {
                    const lastTime = timeSeries[name][timeSeries[name].length - 1][0];
                    if (lastTime && report.timestamp && report.timestamp - lastTime > 20000) {
                        // Insert a null value to create a gap.
                        timeSeries[name].push([stats[id].timestamp || new Date(trace[i].time).getTime(), null]);
                    }
                }
                timeSeries[name].push([report.timestamp, report[name]]);
            });
        });
    }
    return series;
}

export class RTCStatsDumpImporter extends EventTarget {
    constructor(container) {
        super();
        this.graphs = {};
        this.container = container;
        this.containers = {};
    }

    process(blob) {
        this.data = decompressRtcStats(blob.split('\n'));
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
            const report = timeSeries[statsId];
            if (['local-candidate', 'remote-candidate', 'codec'].includes(report.type)) continue;
            const graphType = report.type;

            // recreate the webrtc-internals format (for now)
            const data = Object.keys(report).filter(name => name !== 'type').map(name => {
                return [name, report[name], report.type];
            });

            const graphOptions = createGraphOptions(statsId, report.type, data);
            if (!graphOptions) {
                continue;
            }
            // Determine if a series visibility was toggled.
            let previouslyVisible = graphOptions.series.map(s => s.visible);
            graphOptions.chart.events = {
                redraw: () => {
                    graph.series.forEach((series, index) => {
                        const visible = series.visible;
                        if (visible === previouslyVisible[index]) return;
                        if (visible && !previouslyVisible[index]) {
                            console.log('SERIES SHOWN', series.name, series);
                        } else {
                            console.log('SERIES HIDDEN', series.name, series);
                        }
                    });
                    previouslyVisible = graph.series.map(s => s.visible);
                    // coalesce into a single event and emit?
                },
                selection: (event) => {
                    // Determine if a graph was zoomed in or zoomed out.
                    if (event.xAxis) {
                        console.log('zoom in to', event.xAxis[0]);
                    } else {
                        console.log('zoom out');
                    }
                },
            };

            const container = document.createElement('details');
            container.addEventListener('toggle', (event) => {
                // This graph was opened (see event.newState) so must be interesting?
            });
            if (graphOptions.series.statsType) {
                container.attributes['data-statsType'] = graphOptions.series.statsType;
            }
            this.containers[connectionId].graphs.appendChild(container);
            // TODO: keep in sync with
            // https://source.chromium.org/chromium/chromium/src/+/main:content/browser/webrtc/resources/stats_helper.js
            const title = [
                'type', 'kind',
                'ssrc', 'rtxSsrc', 'fecSsrc',
                'mid', 'rid', 'encodingIndex',
                'label',
                '[codec]',
                'encoderImplementation', 'decoderImplementation',
                'trackIdentifier',
                'id',
                'visibleSeries', // importer extension.
            ].filter(key => graphOptions.labels[key] !== undefined)
                .map(key => {
                    return ({statsType: 'type', trackIdentifier: 'track'}[key] || key) + '=' + JSON.stringify(graphOptions.labels[key]);
                }).join(', ');

            const titleElement = document.createElement('summary');
            titleElement.innerText = title;
            container.appendChild(titleElement);

            const d = document.createElement('div');
            d.id = 'chart_' + Date.now();
            d.classList.add('graph');
            container.appendChild(d);

            const graph = new Highcharts.Chart(d, graphOptions);
            this.graphs[connectionId][statsId] = graph;

            // expand the graph when opening
            container.ontoggle = () => container.open && graph.reflow();

            // draw checkbox to turn off everything
            ((container, graph) => {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                container.appendChild(checkbox);
                const label = document.createElement('label');
                label.innerText = 'Turn on/off all data series';
                container.appendChild(label);
                checkbox.onchange = function() {
                    graph.series.forEach(series => {
                        series.setVisible(!checkbox.checked, false);
                    });
                    graph.redraw();
                };
            })(container, graph);
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
        const row = document.createElement('tr');
        let el = document.createElement('td');
        el.setAttribute('nowrap', '');
        el.innerText = traceEvent.time.toLocaleTimeString(); // TODO: make this configurable via settings.
        el.title = traceEvent.time.toISOString().split('T'); // Only way to get milliseconds.
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
