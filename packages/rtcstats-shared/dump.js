import {
    decompressMethod,
    descriptionDecompression,
    statsDecompression,
} from './compression.js';
import {createInternalsTimeSeries} from './timeseries.js';
import {parseTrackWithStreams} from './utils.js';

// Chrome JSON-encodes the state in these events, rtcstats-js writes it bare.
// https://chromium-review.googlesource.com/c/chromium/src/+/6917903
const STATE_VALUES = {
    onsignalingstatechange: {
        '"stable"': 'stable',
        '"have-local-offer"': 'have-local-offer',
        '"have-remote-offer"': 'have-remote-offer',
        '"have-local-pranswer"': 'have-local-pranswer',
        '"have-remote-pranswer"': 'have-remote-pranswer',
        '"closed"': 'closed',
    },
    oniceconnectionstatechange: {
        '"new"': 'new',
        '"checking"': 'checking',
        '"connected"': 'connected',
        '"completed"': 'completed',
        '"failed"': 'failed',
        '"disconnected"': 'disconnected',
        '"closed"': 'closed',
    },
    onconnectionstatechange: {
        '"new"': 'new',
        '"connecting"': 'connecting',
        '"connected"': 'connected',
        '"disconnected"': 'disconnected',
        '"failed"': 'failed',
        '"closed"': 'closed',
    },
    onicegatheringstatechange: {
        '"new"': 'new',
        '"gathering"': 'gathering',
        '"complete"': 'complete',
    },
};

// Call before format detection, dumps are frequently stored gzipped.
export async function maybeUncompressDump(blob) {
    const magic = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (magic[0] !== 0x1f || magic[1] !== 0x8b) {
        return blob;
    }
    return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
}

export async function detectRTCStatsDump(blob) {
    const magic = await blob.slice(0, 13).text();
    return magic.startsWith('RTCStatsDump\n');
}

export async function detectWebRTCInternalsDump(blob) {
    return (await blob.slice(0, 1).text()) === '{';
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
    // Ensure the client-level connection is listed before the peer connections.
    data.peerConnections = {null: []};
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

        value = STATE_VALUES[method]?.[value] || value;

        if (method === 'getStats') { // delta-compressed stats
            // statsDecompression does not modify its base stats argument.
            value = statsDecompression(baseStats[connection_id], value);
            baseStats[connection_id] = value;
        } else if (method === 'setLocalDescription' && value &&
            // Workaround for Chrome <145 bug: https://source.chromium.org/chromium/chromium/src/+/4a2a384e43ea163127219548087e949fb00fa562
            connection_id !== 'undefined-undefined') {
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
    if (!data.peerConnections['null'].length) {
        delete data.peerConnections['null'];
    }
    return data;
}

export async function readWebRTCInternalsDump(blob) {
    const textBlob = await blob.text();
    return JSON.parse(textBlob);
}

// Convert a webrtc-internals dump into the same shape readRTCStatsDump returns
// so the existing feature extractors (mostly) work.
export function internalsToRtcstats(data) {
    const peerConnections = {};
    const startTimestamp = data.timestamp || 0;

    const clientTrace = [{
        type: 'create',
        value: {
            cpuPerformance: data.cpuPerformance,
            deviceMemory: data.deviceMemory,
            hardwareConcurrency: data.hardwareConcurrency,
            userAgent: data.UserAgent,
            userAgentData: data.UserAgentData,
        },
        timestamp: startTimestamp,
        extra: [],
    }];

    for (const gum of (data.getUserMedia || [])) {
        const baseType = 'navigator.mediaDevices.' + gum.request_type;
        if (gum.error !== undefined) {
            clientTrace.push({type: baseType + 'OnFailure', value: gum.error, timestamp: gum.timestamp, extra: []});
        } else if (gum.audio_track_info !== undefined || gum.video_track_info !== undefined) {
            const tracks = [];
            if (gum.audio_track_info) {
                const t = JSON.parse(gum.audio_track_info);
                tracks.push(['audio', t.id, t.label, gum.stream_id]);
            }
            if (gum.video_track_info) {
                const t = JSON.parse(gum.video_track_info);
                tracks.push(['video', t.id, t.label, gum.stream_id]);
            }
            clientTrace.push({type: baseType + 'OnSuccess', value: tracks, timestamp: gum.timestamp, extra: []});
        } else if (gum.audio !== undefined || gum.video !== undefined) {
            const value = {};
            if (gum.audio !== undefined) value.audio = gum.audio === '' ? true : gum.audio;
            if (gum.video !== undefined) value.video = gum.video === '' ? true : gum.video;
            clientTrace.push({type: baseType, value, timestamp: gum.timestamp, extra: []});
        }
    }
    clientTrace.sort((a, b) => a.timestamp - b.timestamp);
    peerConnections['null'] = clientTrace;

    for (const id of Object.keys(data.PeerConnections || {})) {
        const pc = data.PeerConnections[id];
        const trace = [{
            type: 'create',
            value: pc.rtcConfiguration,
            timestamp: pc.updateLog?.[0]?.timestamp || startTimestamp,
            extra: [],
        }];
        for (const ev of (pc.updateLog || [])) {
            let value = ev.value;
            if (typeof value === 'string' && value.length > 0) {
                try { value = JSON.parse(value); } catch (_) { /* keep as string */ }
            }
            trace.push({
                type: ev.type,
                value,
                timestamp: ev.timestamp || (ev.time ? new Date(ev.time).getTime() : 0),
                extra: [],
            });
        }
        // Convert the per-property stats timeseries back into per-tick getStats events.
        const series = createInternalsTimeSeries(pc);
        if (series) {
            const byTimestamp = new Map();
            for (const statsId of Object.keys(series)) {
                const statsType = series[statsId].type;
                for (const property of Object.keys(series[statsId])) {
                    if (['type', 'timestamp', 'id'].includes(property)) continue;
                    for (const [ts, value] of series[statsId][property]) {
                        if (!byTimestamp.has(ts)) byTimestamp.set(ts, {});
                        const report = byTimestamp.get(ts);
                        if (!report[statsId]) {
                            report[statsId] = {id: statsId, timestamp: ts, type: statsType};
                        }
                        report[statsId][property] = value;
                    }
                }
            }
            for (const ts of byTimestamp.keys()) {
                trace.push({type: 'getStats', value: byTimestamp.get(ts), timestamp: ts, extra: []});
            }
        }
        trace.sort((a, b) => a.timestamp - b.timestamp);
        peerConnections[id] = trace;
    }
    return {peerConnections, eventSizes: {}};
}

// Uncompress if needed, auto-detect the dump format and dispatch.
export async function readDump(blob) {
    const dump = await maybeUncompressDump(blob);
    if (await detectRTCStatsDump(dump)) {
        return readRTCStatsDump(dump);
    }
    if (!await detectWebRTCInternalsDump(dump)) {
        throw new Error('Unrecognized dump format');
    }
    return internalsToRtcstats(await readWebRTCInternalsDump(dump));
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
            if (tracks.find(info => info.direction === 'inbound' &&
                    info.id === trackInformation.id) === undefined) {
                tracks.push(trackInformation);
            }
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
        } else if (traceEvent.type === 'transceiverAdded') {
            // chrome://webrtc-internals non-spec event.
            const {value} = traceEvent;
            if (['addTrack', 'addTransceiver'].includes(traceEvent.value?.reason)) {
                const trackInformation = {
                    startTime: traceEvent.timestamp,
                    direction: 'outbound',
                    kind: value.kind,
                    id: value.sender.track,
                    label: value.sender.track,
                    streams: value.sender.streams,
                };
                tracks.push(trackInformation);
            } else if (traceEvent.value?.reason === 'setRemoteDescription') {
                const trackInformation = {
                    startTime: traceEvent.timestamp,
                    direction: 'inbound',
                    kind: value.kind,
                    id: value.receiver.track,
                    label: value.receiver.track,
                    streams: value.receiver.streams,
                };
                if (tracks.find(info => info.id === trackInformation.id) === undefined) {
                    tracks.push(trackInformation);
                }
            }
        } else if (traceEvent.type === 'transceiverModified') {
            // A transceiver created locally only starts receiving once the
            // negotiation is done, which is the only signal for inbound tracks
            // in dumps from Chrome versions without the ontrack event.
            const {value} = traceEvent;
            if (value.currentDirection?.includes('recv') && value.receiver?.track) {
                const trackInformation = {
                    startTime: traceEvent.timestamp,
                    direction: 'inbound',
                    kind: value.kind,
                    id: value.receiver.track,
                    label: value.receiver.track,
                    streams: value.receiver.streams,
                };
                if (tracks.find(info => info.id === trackInformation.id) === undefined) {
                    tracks.push(trackInformation);
                }
            }
        }
    }
    return tracks;
}

