/* eslint sort-keys: "error" */
import {parseTrackWithStreams} from '@rtcstats/rtcstats-shared';

export function extractClientFeatures(clientTrace) {
    // This should always exist.
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
        })?.value || '',
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

    return {
        ...create,
        duration: clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp,
        ...enumerateDevices,
        ...getDisplayMedia,
        ...getUserMedia,
        startTime: clientTrace[0].timestamp,
    };
}

export function extractConnectionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    return {
        closed: peerConnectionTrace[peerConnectionTrace.length - 1].type === 'close',
        duration: peerConnectionTrace.length
            ? peerConnectionTrace[peerConnectionTrace.length - 1].timestamp - peerConnectionTrace[0].timestamp
            : 0,
        numberOfEvents: peerConnectionTrace.length,
        numberOfEventsNotGetStats: peerConnectionTrace.filter(traceEvent => traceEvent.type !== 'getStats').length,
        startTime: peerConnectionTrace[0].timestamp,
    };
}

export function extractTrackFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
    // Track stats can be extracted by itering over peerConnectionTrace and looking at getStats
    // events which are associated with trackInformation.statsId.
    const features = {
        direction: trackInformation.direction,
        duration: 0,
        kind: trackInformation.kind,
        startTime: trackInformation.startTime,
        trackId: trackInformation.id,
    };
    // Find the last stats.
    for (let i = peerConnectionTrace.length - 1; i >= 0; i--) {
        const traceEvent = peerConnectionTrace[i];
        if (traceEvent.type !== 'getStats') continue;
        features['duration'] = Math.floor(traceEvent.timestamp - trackInformation.startTime);
        break;
    }
    return {
        ...features,
    };
}
