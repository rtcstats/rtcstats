/* eslint sort-keys: "error" */

/* Client features are features that describe the client, independent of a particular peerconnection.
 * They are calculated based on the clientTrace, i.e. the events that are not associated with a
 * connection such as getUserMedia or enumerateDevices.
 */

function countEvents(trace, ...types) {
    return trace.reduce((count, traceEvent) => types.includes(traceEvent.type) ? count + 1 : count, 0);
}

// The USB id of the first device of that kind acquired via getUserMedia.
// Labels of USB devices end with the vendor:product id, e.g. "Logitech BRIO (046d:085e)".
function deviceUsbId(clientTrace, kind) {
    for (const traceEvent of clientTrace) {
        if (traceEvent.type !== 'navigator.mediaDevices.getUserMediaOnSuccess') {
            continue;
        }
        for (const track of traceEvent.value) {
            const label = track[2] || '';
            if (track[0] !== kind || !label.endsWith(')')) {
                continue;
            }
            const usbId = label.slice(-10, -1);
            if (usbId[4] === ':') {
                return usbId;
            }
        }
    }
}

// Client features related to getUserMedia.
function getUserMediaFeatures(clientTrace) {
    return {
        audioDeviceUsbId: deviceUsbId(clientTrace, 'audio'),
        calledGetUserMedia: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called at least once.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia';
        }) !== undefined,
        calledGetUserMediaAudio: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting audio.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && !!traceEvent.value?.audio;
        }) !== undefined,
        calledGetUserMediaCombined: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting both audio and video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' &&
                !!traceEvent.value?.audio && !!traceEvent.value?.video;
        }) !== undefined,
        calledGetUserMediaVideo: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && !!traceEvent.value?.video;
        }) !== undefined,
        getUserMediaError: clientTrace.find(traceEvent => {
            // The first getUserMedia error event, if any.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnFailure';
        })?.value,
        // The number of failed getUserMedia calls.
        getUserMediaErrorCount: countEvents(clientTrace, 'navigator.mediaDevices.getUserMediaOnFailure'),
        // The number of successful getUserMedia calls.
        getUserMediaSuccessCount: countEvents(clientTrace, 'navigator.mediaDevices.getUserMediaOnSuccess'),
        videoDeviceUsbId: deviceUsbId(clientTrace, 'video'),
    };
}

// Client features related to getDisplayMedia.
function getDisplayMediaFeatures(clientTrace) {
    return {
        calledGetDisplayMedia: clientTrace.find(traceEvent => {
            // Whether getDisplayMedia was called at least once.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia';
        }) !== undefined,
        calledGetDisplayMediaAudio: clientTrace.find(traceEvent => {
            // Whether getDisplayMedia was called requesting audio.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && !!traceEvent.value?.audio;
        }) !== undefined,
        calledGetDisplayMediaVideo: clientTrace.find(traceEvent => {
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && traceEvent.value?.video !== false;
        }) !== undefined,
        // The number of failed getDisplayMedia calls.
        getDisplayMediaErrorCount: countEvents(clientTrace, 'navigator.mediaDevices.getDisplayMediaOnFailure'),
        // The number of successful getDisplayMedia calls.
        getDisplayMediaSuccessCount: countEvents(clientTrace, 'navigator.mediaDevices.getDisplayMediaOnSuccess'),
    };
}

// Client features related to enumerateDevices.
function enumerateDevicesFeatures(clientTrace) {
    return {
        // How often enumerateDevices was called.
        enumerateDevicesCount: countEvents(clientTrace, 'navigator.mediaDevices.enumerateDevices'),
    };
}

// Client features related to the rtcstats-js websocket connection.
function webSocketFeatures(clientTrace) {
    return {
        webSocketConnectionTime: clientTrace.find(traceEvent => {
            return traceEvent.type === 'websocket';
        })?.value?.connectionTime,
    };

}

// Client features related to the track (in case it is never added to a connection).
function trackFeatures(clientTrace) {
    const features = {};
    const allTracks = {};
    for (const traceEvent of clientTrace) {
        if (traceEvent.type === 'navigator.mediaDevices.getUserMediaOnSuccess') {
            for (const track of traceEvent.value) {
                allTracks[track[1]] = {
                    kind: track[0],
                    start: traceEvent.timestamp,
                };
            }
        } else if (traceEvent.type === 'MediaStreamTrack.onended') {
            const track = allTracks[traceEvent.value];
            if (track) {
                features[track.kind + 'Ended'] = true;
                if (traceEvent.timestamp - track.start < 1000) {
                    features[track.kind + 'ShortDuration'] = true;
                }
            }
        }
    }
    return features;
}

export function extractClientFeatures(clientTrace) {
    // A trace will always have at least one event.
    const create = clientTrace.find(traceEvent => traceEvent.type === 'create').value;

    return {
        ...create,
        // The lifetime of the client in milliseconds.
        duration: clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp,
        // Normalized OS family from navigator.userAgentData.platform; undefined for non-Chromium browsers.
        operatingSystem: create.userAgentData?.platform,
        ...enumerateDevicesFeatures(clientTrace),
        ...getDisplayMediaFeatures(clientTrace),
        ...getUserMediaFeatures(clientTrace),
        // The timestamp at which RTCStatsDump was started.
        startTime: clientTrace[0].timestamp,
        ...trackFeatures(clientTrace),
        ...webSocketFeatures(clientTrace),
    };
}

