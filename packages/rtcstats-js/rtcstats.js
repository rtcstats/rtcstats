import {wrapRTCPeerConnection} from './peerconnection.js';
import {wrapGetUserMedia, wrapEnumerateDevices} from './media.js';
import {WebSocketTrace} from './trace-websocket.js';

/**
 * Wrap RTCStats WebSocket trace with default options.
 *
 * @returns {function} RTCStats trace function.
 */
export function wrapRTCStatsWithDefaultOptions(config = {getStatsInterval: 1000}, target = globalThis) {
    const trace = new WebSocketTrace(config);

    // Wrap RTCPeerConnection-related APIs and events
    wrapRTCPeerConnection(trace, target, config);
    // Wrap getUserMedia, getDisplayMedia and related events.
    wrapGetUserMedia(trace, target);
    // Wrap enumerateDevices.
    wrapEnumerateDevices(trace, target);

    return trace;
}

export {
    wrapRTCPeerConnection,
    wrapGetUserMedia,
    wrapEnumerateDevices,
    WebSocketTrace,
};
