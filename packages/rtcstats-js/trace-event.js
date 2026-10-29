import {compressMethod} from '@rtcstats/rtcstats-shared';

/**
 * Trace function that dispatches each trace line as an `rtcstats` event
 * instead of sending it over a WebSocket. The listener decides where the
 * line goes, for example over IPC to an Electron main process.
 *
 * The event detail is `{timestamp, method, pcId, line, pc?}`:
 * - `timestamp`: wall clock time of the trace call, in ms.
 * - `method`: the method name, uncompressed.
 * - `pcId`: the peer connection id, or null.
 * - `line`: the JSON array `[compressed method, pcId, ...args, delta]`, ready
 *   to write: the same line as WebSocketTrace, time delta included.
 * - `pc`: 'created' or 'closed' on the first and the last line of a
 *   peer connection, so that a listener can tell when a call starts and ends.
 *
 * @returns {function} RTCStats trace function.
 */
export function EventTrace() {
    const target = new EventTarget();
    const closed = new Set();
    let lastTime = 0;
    const trace = function(...args) {
        const timestamp = Date.now();
        if (args[1] instanceof RTCPeerConnection) {
            args[1] = args[1].__rtcStatsId;
        }
        const method = args[0];
        const pcId = args[1] ?? null;
        let pc;
        if (pcId !== null && method === 'create') {
            pc = 'created';
        } else if (pcId !== null && method === 'close' && !closed.has(pcId)) {
            closed.add(pcId);
            pc = 'closed';
        }
        args[0] = compressMethod(method);
        args.push(timestamp - lastTime);
        lastTime = timestamp;
        const detail = {timestamp, method, pcId, line: JSON.stringify(args)};
        if (pc) {
            detail.pc = pc;
        }
        target.dispatchEvent(new CustomEvent('rtcstats', {detail}));
    };
    trace.addEventListener = target.addEventListener.bind(target);
    trace.removeEventListener = target.removeEventListener.bind(target);

    // Same first line as WebSocketTrace.connect(), without a transport.
    // A test checks that both send the same metadata.
    trace.connect = () => {
        // New session: the create line carries an absolute timestamp.
        lastTime = 0;
        trace('create', null, {
            hardwareConcurrency: navigator.hardwareConcurrency,
            userAgentData: navigator.userAgentData,
            deviceMemory: navigator.deviceMemory,
            cpuPerformance: navigator.cpuPerformance,
            screen: {
                width: window.screen?.availWidth,
                height: window.screen?.availHeight,
                devicePixelRatio: window.devicePixelRatio,
            },
            window: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });
    };
    return trace;
}
