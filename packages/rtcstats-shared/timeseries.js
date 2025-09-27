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
            };
        }
        if (!connection.stats[statsId + '-timestamp']) {
            // Individual timestamps were added in crbug.com/1462567 in M117.
            // This version is not supported anymore.
            console.error('webrtc-internals dump missing timestamps for stats added in M117.');
            return;
        }
        const timestamps = JSON.parse(connection.stats[statsId + '-timestamp'].values);
        series[statsId][statsProperty] = JSON.parse(stats.values).map((currentValue, index) => {
            return [timestamps[index], currentValue];
        });
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
            if (!series[id]) {
                series[id] = {};
                series[id].type = stats[id].type;
            }
            for (const statsProperty in report) {
                if (['timestamp', 'type', 'id'].includes(statsProperty)) continue;
                const timeSeries = series[id];
                if (!timeSeries[statsProperty]) {
                    timeSeries[statsProperty] = [];
                }
                timeSeries[statsProperty].push([report.timestamp, report[statsProperty]]);
            }
        }
    }
    return series;
}

// Inserts null values for gaps in timeseries which creates a gap in Highcharts plots.
// TODO: figure out how to show the markers for this point.
// Possibly using https://api.highcharts.com/highcharts/plotOptions.series.zones
export function insertNullForGapsIntoTimeSeries(timeSeries, gapSizeMs = 5000) {
    const newSeries = [timeSeries[0]];;
    for (let i = 1; i < timeSeries.length; i++) {
        const delta = timeSeries[i][0] - timeSeries[i - 1][0];
        if (delta > gapSizeMs) {
            newSeries.push([timeSeries[i][0], null]);
        }
        newSeries.push([timeSeries[i][0], timeSeries[i][1]]);
    }
    return newSeries;
}
