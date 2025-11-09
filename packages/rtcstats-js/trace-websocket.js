import {compressMethod} from '@rtcstats/rtcstats-shared';

const PROTOCOL_VERSION = '5.0';

export function WebSocketTrace() {
    let buffer = [];
    let connection;
    let lastTime = 0;
    const trace = function(...args) {
        const now = Date.now();
        args.push(now - lastTime);
        lastTime = now;

        if (args[1] instanceof RTCPeerConnection) {
            args[1] = args[1].__rtcStatsId;
        }
        const method = args[0];
        args[0] = compressMethod(method);
        if (connection) {
            if (connection.readyState === WebSocket.OPEN) {
                if (buffer.length === 0) {
                    connection.send(JSON.stringify(args));
                } else {
                    buffer.push(args);
                }
            } else if (connection.readyState >= WebSocket.CLOSING) {
                // no-op. Possibly log?
            }
        } else {
            buffer.push(args);
        }
    };
    trace('create', null, {
        hardwareConcurrency: navigator.hardwareConcurrency,
        userAgentData: navigator.userAgentData,
        deviceMemory: navigator.deviceMemory,
        screen: {
            width: window.screen.availWidth,
            height: window.screen.availHeight,
            devicePixelRatio: window.devicePixelRatio,
        },
        window: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
    });

    trace.close = () => {
        connection.close();
    };
    trace.connect = (wsURL) => {
        if (connection) {
            connection.close();
        }
        connection = new WebSocket(wsURL, 'rtcstats#' + PROTOCOL_VERSION);
        connection.addEventListener('error', (e) => {
            // console.error('WS ERROR', e);
        });

        connection.addEventListener('close', () => {
            // reconnect?
        });

        connection.addEventListener('open', () => {
            setTimeout(function flush() {
                if (!buffer.length) {
                    return;
                }
                connection.send(JSON.stringify(buffer.shift()));
                setTimeout(flush, 0);
            }, 0);
        });

        connection.addEventListener('message', (msg) => {
            // no messages from the server defined yet.
        });
    };
    return trace;
}
