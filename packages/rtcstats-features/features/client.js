/* eslint sort-keys: "error" */

/* Client features are features that describe the client, independent of a particular peerconnection.
 * They are calculated based on the clientTrace, i.e. the events that are not associated with a
 * connection such as getUserMedia or enumerateDevices.
 */

// Client features related to getUserMedia.
function getUserMediaFeatures(clientTrace) {
    return {
        calledGetUserMedia: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called at least once.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia';
        }) !== undefined,
        calledGetUserMediaAudio: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting audio.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && traceEvent.value?.audio !== false;
        }) !== undefined,
        calledGetUserMediaCombined: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting both audio and video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' &&
                traceEvent.value?.audio !== false && traceEvent.value?.video !== false;
        }) !== undefined,
        calledGetUserMediaVideo: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && traceEvent.value?.video !== false;
        }) !== undefined,
        getUserMediaError: clientTrace.find(traceEvent => {
            // The first getUserMedia error event, if any.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnFailure';
        })?.value,
        getUserMediaErrorCount: clientTrace.filter(traceEvent => {
            // The number of failed getUserMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnFailure';
        }).length,
        getUserMediaSuccessCount: clientTrace.filter(traceEvent => {
            // The number of successful getUserMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnSuccess';
        }).length,
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
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && traceEvent.value?.audio !== false;
        }) !== undefined,
        calledGetDisplayMediaVideo: clientTrace.find(traceEvent => {
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && traceEvent.value?.video !== false;
        }) !== undefined,
        getDisplayMediaErrorCount: clientTrace.filter(traceEvent => {
            // The number of failed getDisplayMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMediaOnFailure';
        }).length,
        getDisplayMediaSuccessCount: clientTrace.filter(traceEvent => {
            // The number of successful getDisplayMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMediaOnSuccess';
        }).length,
    };
}

// Client features related to enumerateDevices.
function enumerateDevicesFeatures(clientTrace) {
    return {
        enumerateDevicesCount: clientTrace.filter(traceEvent => {
            // How often enumerateDevices was called.
            return traceEvent.type === 'navigator.mediaDevices.enumerateDevices';
        }).length,
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

export function extractClientFeatures(clientTrace) {
    // A trace will always have at least one event.
    const create = clientTrace.find(traceEvent => traceEvent.type === 'create').value;

    return {
        ...create,
        // The lifetime of the client in milliseconds.
        duration: clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp,
        ...enumerateDevicesFeatures(clientTrace),
        ...getDisplayMediaFeatures(clientTrace),
        ...getUserMediaFeatures(clientTrace),
        // The timestamp at which RTCStatsDump was started.
        startTime: clientTrace[0].timestamp,
        ...webSocketFeatures(clientTrace),
    };
}

