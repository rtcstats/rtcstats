/* eslint sort-keys: "error" */
import {parseTrackWithStreams} from '@rtcstats/rtcstats-shared';

export function extractClientFeatures(clientTrace) {
    // This should always exist.
    const create = clientTrace.find(traceEvent => traceEvent.type === 'create').value;
    return {
        ...create,
        duration: clientTrace.length
            ? clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp
            : 0,
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
