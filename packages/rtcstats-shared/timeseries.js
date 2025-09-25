/**
 * Creates a timeseries from webrtc-internals.
 * Returns an object with stats by id and an object of property=> [[ts, value], ...].
 */
export function createInternalsTimeSeries(connection) {
    const series = {};
    for (const reportname in connection.stats) {
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
 * Returns an object with stats by id and an object of property=> [[ts, value], ...].
 */
export function createRtcStatsTimeSeries(trace) {
    const series = {};
    for (const traceEvent of trace) {
        if (traceEvent.type !== 'getStats') {
            continue;
        }
        const stats = traceEvent.value;
        for (const id in stats) {
            const report = stats[id];
            for (const name in report) {
                if (name === 'timestamp') continue;
                if (name === 'type') continue;
                if (name === 'id') continue;
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
                        timeSeries[name].push([stats[id].timestamp || new Date(traceEvent.time).getTime(), null]);
                    }
                }
                timeSeries[name].push([report.timestamp, report[name]]);
            }
        }
    }
    return series;
}

