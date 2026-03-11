/* eslint sort-keys: "error" */

export function extractClientFeatures(clientTrace) {
    // A trace will always have at least one event.
    const create = clientTrace.find(traceEvent => traceEvent.type === 'create').value;
    const getUserMedia = {
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
    const getDisplayMedia = {
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
    const enumerateDevices = {
        enumerateDevicesCount: clientTrace.filter(traceEvent => {
            // How often enumerateDevices was called.
            return traceEvent.type === 'navigator.mediaDevices.enumerateDevices';
        }).length,
    };

    const webSocket = {
        webSocketConnectionTime: clientTrace.find(traceEvent => {
            return traceEvent.type === 'websocket';
        })?.value?.connectionTime,
    };

    return {
        ...create,
        // The lifetime of the client in milliseconds.
        duration: clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp,
        ...enumerateDevices,
        ...getDisplayMedia,
        ...getUserMedia,
        // The timestamp at which RTCStatsDump was started.
        startTime: clientTrace[0].timestamp,
        ...webSocket,
    };
}

