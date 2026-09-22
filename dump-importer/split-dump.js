import {
    decompressMethod,
    detectRTCStatsDump,
    detectWebRTCInternalsDump,
    readWebRTCInternalsDump,
} from '@rtcstats/rtcstats-shared';

const UNKNOWN_ORIGIN = 'unknown origin';

function parseUrl(value) {
    try {
        return new URL(value);
    } catch (e) {
        return undefined;
    }
}

// Chrome connection ids are "<renderer process id>-<index>".
function tabOf(connectionId) {
    return String(connectionId).replace(/-\d+$/, '');
}

// Skipping unparseable lines keeps a truncated dump splittable.
function parseLine(line) {
    if (!line.trim().length) {
        return;
    }
    let data;
    try {
        data = JSON.parse(line);
    } catch (e) {
        return;
    }
    if (Array.isArray(data)) {
        return data;
    }
}

function resolveOrigins(entries, fallbackOrigin) {
    const tabUrls = new Map();
    for (const entry of entries.values()) {
        if (entry.url && !tabUrls.has(entry.tab)) {
            tabUrls.set(entry.tab, entry.url);
        }
    }
    for (const entry of entries.values()) {
        entry.url = entry.url || tabUrls.get(entry.tab);
        const url = entry.url || fallbackOrigin;
        const origin = url && parseUrl(url)?.origin;
        // file:// and other opaque origins all stringify to "null".
        entry.origin = (origin && origin !== 'null' ? origin : url) || UNKNOWN_ORIGIN;
    }
}

function summarize(entries) {
    const origins = new Map();
    for (const entry of entries.values()) {
        let origin = origins.get(entry.origin);
        if (!origin) {
            origin = {origin: entry.origin, traces: [], connections: 0, events: 0,
                getUserMediaCalls: 0, bytes: 0};
            origins.set(entry.origin, origin);
        }
        if (entry.isConnection) {
            origin.connections++;
            origin.traces.push({id: entry.id, events: entry.events, start: entry.start, end: entry.end});
        }
        origin.events += entry.events;
        origin.getUserMediaCalls += entry.getUserMediaCalls;
        origin.bytes += entry.bytes;
    }
    for (const origin of origins.values()) {
        origin.traces.sort((a, b) => a.start - b.start);
    }
    return [...origins.values()];
}

// Deliberately not readRTCStatsDump: these dumps store their statistics
// uncompressed, and writing them back out would compress them, renumbering
// stats ids and dropping certificate stats and per-report timestamps.
function parseRtcStatsDump(text) {
    const lines = text.split('\n');
    let metadata;
    try {
        metadata = JSON.parse(lines[1]);
    } catch (e) {
        return;
    }
    const entries = new Map();
    const events = [];
    let timestamp = 0;

    for (let index = 2; index < lines.length; index++) {
        const data = parseLine(lines[index]);
        if (!data) {
            continue;
        }
        const connectionId = data[1];
        // The last element is the time relative to the previous line.
        timestamp += data[data.length - 1];
        events.push({index, connectionId, timestamp});

        if (connectionId === null) {
            // Browser-level information such as the user agent, always kept.
            continue;
        }
        let entry = entries.get(connectionId);
        if (!entry) {
            entry = {id: connectionId, tab: tabOf(connectionId), url: undefined,
                isConnection: false, events: 0, getUserMediaCalls: 0, bytes: 0,
                start: Infinity, end: -Infinity};
            entries.set(connectionId, entry);
        }
        entry.events++;
        entry.bytes += lines[index].length;
        entry.start = Math.min(entry.start, timestamp);
        entry.end = Math.max(entry.end, timestamp);
        const method = decompressMethod(data[0]);
        const isGetUserMedia = method.startsWith('navigator.mediaDevices.');
        // A trace with nothing but getUserMedia calls has no peer connection.
        entry.isConnection = entry.isConnection || !isGetUserMedia;
        if (method === 'navigator.mediaDevices.getUserMedia') {
            entry.getUserMediaCalls++;
        }
        if (!entry.url && (method === 'create' || isGetUserMedia)) {
            entry.url = data.slice(3, -1).find(parseUrl);
        }
    }
    resolveOrigins(entries, metadata.origin);

    return {
        format: 'rtcstats',
        extension: '.txt',
        origins: summarize(entries),
        build(selectedOrigins) {
            const selected = new Set(selectedOrigins);
            const parts = ['RTCStatsDump\n', JSON.stringify(metadata)];
            let lastTimestamp = 0;
            for (const event of events) {
                if (event.connectionId !== null &&
                    !selected.has(entries.get(event.connectionId).origin)) {
                    continue;
                }
                const data = parseLine(lines[event.index]);
                data[data.length - 1] = event.timestamp - lastTimestamp;
                lastTimestamp = event.timestamp;
                parts.push('\n' + JSON.stringify(data));
            }
            if (text.endsWith('\n')) {
                parts.push('\n');
            }
            return new Blob(parts);
        },
    };
}

function parseWebRTCInternalsDump(json) {
    if (!json.PeerConnections && !json.getUserMedia) {
        return;
    }
    const entries = new Map();
    for (const connectionId of Object.keys(json.PeerConnections || {})) {
        const peerConnection = json.PeerConnections[connectionId];
        const times = (peerConnection.updateLog || [])
            .map(event => event.timestamp || Date.parse(event.time));
        // The update log stops after signaling, the stats keep going.
        for (const key of Object.keys(peerConnection.stats || {})) {
            if (key.endsWith('-timestamp')) {
                const values = JSON.parse(peerConnection.stats[key].values);
                times.push(values[0], values[values.length - 1]);
            }
        }
        entries.set(connectionId, {
            id: connectionId,
            tab: tabOf(connectionId),
            url: peerConnection.url,
            isConnection: true,
            events: (peerConnection.updateLog || []).length,
            getUserMediaCalls: 0,
            bytes: JSON.stringify(peerConnection).length,
            start: Math.min(...times),
            end: Math.max(...times),
        });
    }
    // Chrome logs the origin on a getUserMedia request but not on its result,
    // which shares the process id and so inherits it from the tab.
    (json.getUserMedia || []).forEach((request, index) => {
        entries.set('getUserMedia-' + index, {
            tab: String(request.pid),
            url: request.url || request.origin,
            isConnection: false,
            events: 1,
            // The result of a call is a separate entry, only count the request.
            getUserMediaCalls: request.request_type === 'getUserMedia' &&
                (request.audio !== undefined || request.video !== undefined) ? 1 : 0,
            bytes: JSON.stringify(request).length,
            start: request.timestamp,
            end: request.timestamp,
        });
    });
    resolveOrigins(entries, undefined);

    return {
        format: 'webrtc-internals',
        extension: '.json',
        origins: summarize(entries),
        build(selectedOrigins) {
            const selected = new Set(selectedOrigins);
            const filtered = Object.assign({}, json);
            if (json.PeerConnections) {
                filtered.PeerConnections = {};
                for (const connectionId of Object.keys(json.PeerConnections)) {
                    if (selected.has(entries.get(connectionId).origin)) {
                        filtered.PeerConnections[connectionId] = json.PeerConnections[connectionId];
                    }
                }
            }
            if (json.getUserMedia) {
                filtered.getUserMedia = json.getUserMedia.filter((request, index) => {
                    return selected.has(entries.get('getUserMedia-' + index).origin);
                });
            }
            return new Blob([JSON.stringify(filtered, null, ' ')]);
        },
    };
}

export async function splitDump(blob) {
    if (await detectRTCStatsDump(blob)) {
        return parseRtcStatsDump(await blob.text());
    } else if (await detectWebRTCInternalsDump(blob)) {
        return parseWebRTCInternalsDump(await readWebRTCInternalsDump(blob));
    }
}
