/**
 * Determines whether a timeseries is "boring". This is defined as follows:
 * - a list of known boring series
 * - the name starts with 'total'.
 * - min and max are the same (which filters out static values)
 * - TODO: linear regression?
 * - TODO: less than 10 seconds?
 * - TODO: constant or linear after initial ramp-up?
 *
 * @param {string} name - the stats property name of the series.
 * @param {Array} series - timeseries as an array of [time, value].
 */
export function isBoring(name, series) {
    // Series which are interesting even if their value does not change.
    const interestingSeries = [
        'width', 'height',
        'frameWidth', 'frameHeight',
        'framesPerSecond',
        'targetBitrate',
        'nackCount', 'pliCount', 'firCount',
    ];
    if (interestingSeries.includes(name)) return false;

    if (name.startsWith('total')) return true;
    // Some of these should have been named total...
    const hiddenSeries = [
        'bytesReceived', 'bytesSent', 'retransmittedBytesSent', 'retransmittedBytesReceived',
        'headerBytesReceived', 'headerBytesSent',
        'packetsReceived', 'packetsSent', 'retransmittedBytesSent', 'retransmittedBytesReceived',
        'qpSum',
        'framesEncoded', 'framesDecoded', 'framesReceived', 'framesAssembled', 'framesAssembledFromMultiplePackets',
        'lastPacketReceivedTimestamp', 'lastPacketSentTimestamp',
        'remoteTimestamp', 'estimatedPlayoutTimestamp',
        'audioLevel',
        'jitterBufferEmittedCount', 'jitterBufferDelay', 'jitterBufferTargetDelay', 'jitterBufferMinimumDelay',
        'selectedCandidatePairChanges',
        'requestsSent', 'responsesReceived', 'requestsReceived', 'responsesSent', 'consentRequestsSent', // ICE
        'reportsSent', 'roundTripTimeMeasurements', // RTCP
    ];
    if (hiddenSeries.includes(name)) return true;

    const values = series.slice(1)
        .map(item => item[1])
        .filter(value => !isNaN(value));
    if (!values.length) return true;
    if (values[0] === values[values.length - 1]) {
        const min = Math.min.apply(null, values);
        const max = Math.max.apply(null, values);
        if (min === max) return true;
    }
    return false;
}

/**
 * Creates a timeseries from webrtc-internals.
 * Returns an object with stats by id and an array of [property, [[ts, value], ...]
 */
export function createInternalsTimeSeries(connection) {
    const series = {};
    for (let reportname in connection.stats) {
        if (reportname.startsWith('Conn-')) {
            return {}; // legacy stats, no longer supported. Warning is shown above.
        }
    }
    for (let reportname in connection.stats) {
        // special casing of computed stats, in particular [a-b]
        let statsId;
        let statsProperty;
        if (reportname.indexOf('[') !== -1) {
            const t = reportname.split('[');
            statsProperty = '[' + t.pop();
            statsId = t.join('');
            statsId = statsId.substr(0, statsId.length - 1);
        } else {
            const t = reportname.split('-');
            statsProperty = t.pop();
            statsId = t.join('-');
        }
        if (statsProperty === 'type') continue;
        const stats = connection.stats[reportname];

        if (!series.hasOwnProperty(statsId)) {
            series[statsId] = {
                type: stats.statsType,
                startTime: new Date(stats.startTime).getTime(),
                endTime: new Date(stats.endTime).getTime(),
            };
        }
        let values = JSON.parse(stats.values);
        // Individual timestamps were added in crbug.com/1462567 in M117.
        if (connection.stats[statsId + '-timestamp']) {
            const timestamps = JSON.parse(connection.stats[statsId + '-timestamp'].values);
            values = values.map((currentValue, index) => [timestamps[index], currentValue]);
        } else {
            // Fallback to the assumption that stats were gathered every second.
            values = values.map((currentValue, index) => [series[statsId].startTime + 1000 * index, currentValue]);
        }
        series[statsId][statsProperty] = values;
    }
    return series;
}

/**
 * Creates a timeseries from rtcstats.
 */
export function createRtcStatsTimeSeries(trace) {
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
                if (name === 'id') return;
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

