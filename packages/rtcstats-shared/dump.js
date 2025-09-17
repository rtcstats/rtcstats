import {statsDecompression, decompressMethod} from './compression.js';

export async function readRTCStatsDump(blob) {
    const textBlob = await blob.text();
    const firstLine = await textBlob.slice(0, 13);
    if (firstLine !== 'RTCStatsDump\n') {
        console.error('Not an RTCStatsDump');
        return;
    }
    const lines = (await textBlob.slice(13)).split('\n');

    // The second line must be a JSON object with metadata.
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

        lastTime = extra.pop() + lastTime;
        const time = new Date(lastTime);

        if (method === 'getStats') { // delta-compressed stats
            value = statsDecompression(baseStats[connection_id], value);
            baseStats[connection_id] = JSON.parse(JSON.stringify(value));
        }

        // TODO: more explicit handling via create and close?
        if (!data.peerConnections[connection_id]) {
            data.peerConnections[connection_id] = [];
            baseStats[connection_id] = {};
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

