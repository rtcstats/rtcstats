import {statsDecompression, decompressMethod} from './compression.js';

export async function detectRTCStatsDump(blob) {
    const magic = await blob.slice(0, 13).text();
    return magic.startsWith('RTCStatsDump\n');
}

export async function detectWebRTCInternalsDump(blob) {
    return (await blob.text()).startsWith('{');
}

export async function readRTCStatsDump(blob) {
    const textBlob = await blob.text();
    const firstLine = await textBlob.slice(0, 13);
    if (firstLine !== 'RTCStatsDump\n') {
        console.error('Not an RTCStatsDump');
        return;
    }
    const lines = (await textBlob.slice(13)).split('\n');

    // The second line must be a JSON object with metadata.
    let data;
    try {
        data = JSON.parse(lines.shift());
    } catch(e) {
        console.error('Second line is not JSON data');
        return;
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
        console.error('Second line must be an object');
        return;
    }
    data.peerConnections = {};
    data.eventSizes = {};

    const baseStats = {};
    let lastTime = 0;
    for (let line of lines) {
        if (!line.length) {
            continue; // Ignore empty lines.
        }
        let jsonData;
        try {
            jsonData = JSON.parse(line);
        } catch(e) {
            console.error('Parsing line as JSON failed');
            return;
        }
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
            time, // deprecated, prefer timestamp.
            timestamp: lastTime,
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

