import {compressMethod} from '@rtcstats/rtcstats-shared';

const PROTOCOL_VERSION = '5.0';

export function WebSocketTrace(config = {}) {
    let buffer = [];
    let connection;
    let lastTime = 0;
    let connectionStartTime = 0;
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
            } else if (connection.readyState === WebSocket.CONNECTING) {
                buffer.push(args);
            } else if ([WebSocket.CLOSING, WebSocket.CLOSED].includes(connection.readyState)) {
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
        connectionStartTime = Date.now();
        connection = new WebSocket(wsURL, 'rtcstats#' + PROTOCOL_VERSION);
        connection.addEventListener('error', (e) => {
            // console.error('WS ERROR', e);
        });

        connection.addEventListener('close', (e) => {
            if (e.code === 1008 && config.log) {
                config.log('rtcstats websocket connection closed with error=1008. ' +
                               'Typically this means authorization is required and failed.');
            }
            // reconnect?
        });

        connection.addEventListener('open', () => {
            // Note: open is called while the socket is still authenticating.
            // This can lead to messages being send and dropped when the token
            // is not valid.
            const connectionTime = Date.now() - connectionStartTime;
            setTimeout(function flush() {
                if (!buffer.length) {
                    trace('websocket', null, {
                        connectionTime,
                    });
                    return;
                }
                if (connection.readyState !== WebSocket.OPEN) {
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
