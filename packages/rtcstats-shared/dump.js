import {
    decompressMethod,
    descriptionDecompression,
    statsDecompression,
} from './compression.js';
import {parseTrackWithStreams} from './utils.js';

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
        } else if (method === 'setLocalDescription' && value) {
            // Implicit SLD has no value to decompress.
            let createCall;
            for (let previousIndex = data.peerConnections[connection_id].length - 1; previousIndex >= 0; previousIndex--) {
                if ((value.type === 'offer' && data.peerConnections[connection_id][previousIndex].type === 'createOfferOnSuccess') ||
                    (value.type === 'answer' && data.peerConnections[connection_id][previousIndex].type === 'createAnswerOnSuccess')) {
                    createCall = data.peerConnections[connection_id][previousIndex];
                    break;
                }
            }
            if (createCall) {
                value = descriptionDecompression(createCall.value, value);
            }
        } else if (['createOfferOnSuccess', 'createAnswerOnSuccess'].includes(method)) {
            let sldCall;
            for (let previousIndex = data.peerConnections[connection_id].length - 1; previousIndex >= 0; previousIndex--) {
                if ((value.type === 'offer' && data.peerConnections[connection_id][previousIndex].type === 'setLocalDescription') ||
                    (value.type === 'answer' && data.peerConnections[connection_id][previousIndex].type === 'setLocalDescription')) {
                    sldCall = data.peerConnections[connection_id][previousIndex];
                    break;
                }
            }
            if (sldCall) {
                value = descriptionDecompression(sldCall.value, value);
            }
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

        if (!data.eventSizes[connection_id]) {
            data.eventSizes[connection_id] = [];
        }
        data.eventSizes[connection_id].push({
            x: lastTime,
            y: line.length,
            method,
        });
    }
    return data;
}

export async function readWebRTCInternalsDump(blob) {
    const textBlob = await blob.text();
    return JSON.parse(textBlob);
}

export async function extractTracks(peerConnectionTrace) {
    const tracks = [];
    for (const traceEvent of peerConnectionTrace) {
        if (traceEvent.type === 'addTrack') {
            const trackInformation = parseTrackWithStreams(traceEvent.value);
            trackInformation.startTime = traceEvent.timestamp;
            trackInformation.direction = 'outbound';
            tracks.push(trackInformation);
        } else if (traceEvent.type === 'ontrack') {
            const trackInformation = parseTrackWithStreams(traceEvent.value);
            trackInformation.startTime = traceEvent.timestamp;
            trackInformation.direction = 'inbound';
            tracks.push(trackInformation);
        } else if (traceEvent.type === 'addTransceiver') {
            if (typeof traceEvent.value[0] === 'string') {
                // TODO: if we pass a kind here, how do we determine the track id?
                // libWebRTC seems to generate a random one for the SDP.
            } else {
                const trackInformation = parseTrackWithStreams(traceEvent.value[0]);
                if (traceEvent.value[1]?.streams) {
                    trackInformation.streams = traceEvent.value[1].streams;
                }
                trackInformation.startTime = traceEvent.timestamp;
                trackInformation.direction = 'outbound';
                tracks.push(trackInformation);
            }
        } else if (traceEvent.type === 'replaceTrack') {
            // This handles tracks that are added with addTransceiver(kind) and replaceTrack.
            const [_, newTrack] = traceEvent.value;
            if (newTrack) {
                const trackInformation = parseTrackWithStreams(newTrack);
                trackInformation.startTime = traceEvent.timestamp;
                trackInformation.direction = 'outbound';
                if (tracks.find(info => info.id === trackInformation.id) === undefined) {
                    tracks.push(trackInformation);
                }
            }
        } else if (traceEvent.type === 'getStats') {
            const report = traceEvent.value;
            Object.keys(report).forEach(id => {
                const stats = report[id];
                if (!['inbound-rtp', 'outbound-rtp' /* TODO: media-source */].includes(stats.type)) {
                    return;
                }
                const associatedTrack = tracks.find(trackInformation => {
                    // Tracks remain associated when replaceTrack is used.
                    if (trackInformation.statsId !== undefined) {
                        return trackInformation.statsId === id;
                    }
                    if (stats.type === 'inbound-rtp') {
                        return trackInformation.id === stats.trackIdentifier;
                    }
                    return trackInformation.id === (stats.mediaSourceId &&
                        report[stats.mediaSourceId] &&
                        report[stats.mediaSourceId].trackIdentifier);
                });
                if (!associatedTrack) {
                    return;
                }
                associatedTrack.statsId = id;
            });
        }
    }
    return tracks;
}
