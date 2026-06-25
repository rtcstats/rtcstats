import {compressMethod} from '@rtcstats/rtcstats-shared';

const PROTOCOL_VERSION = '5.0';
const RELOAD_COUNT_KEY = 'rtcstatsReloadCount';

class WebSocketTracer {
    #config;
    #buffer = [];
    #connection = null;
    #lastTime = 0;
    #connectionStartTime = 0;
    #reloadCount = undefined;

    constructor(config = {}) {
        this.#config = config;

        // This counts the number of times the trace itself has been initialized.
        // Typically this is done once per session and counting (re)loads based
        // on that does not require listening for onload etc.
        if (window.sessionStorage && config.countReloads) {
            const stored = parseInt(window.sessionStorage.getItem(RELOAD_COUNT_KEY), 10);
            this.#reloadCount = Number.isNaN(stored) ? 0 : stored + 1;
            window.sessionStorage.setItem(RELOAD_COUNT_KEY, this.#reloadCount);
        }
    }

    trace(...args) {
        const now = Date.now();
        args.push(now - this.#lastTime);
        this.#lastTime = now;

        if (args[1] instanceof RTCPeerConnection) {
            args[1] = args[1].__rtcStatsId;
        }
        const method = args[0];
        args[0] = compressMethod(method);
        if (this.#connection) {
            if (this.#connection.readyState === WebSocket.OPEN) {
                if (this.#buffer.length === 0) {
                    this.#connection.send(JSON.stringify(args));
                } else {
                    this.#buffer.push(args);
                }
            } else if (this.#connection.readyState === WebSocket.CONNECTING) {
                this.#buffer.push(args);
            } else if ([WebSocket.CLOSING, WebSocket.CLOSED].includes(this.#connection.readyState)) {
                // no-op. Possibly log?
            }
        } else {
            this.#buffer.push(args);
        }
    }

    close() {
        if (window.sessionStorage && this.#config.countReloads) {
            // A clean disconnect clears the reload count.
            window.sessionStorage.removeItem(RELOAD_COUNT_KEY);
        }
        if (this.#connection) {
            this.#connection.close();
            this.#connection = null;
            // New traces need to get an absolute timestamp.
            this.#lastTime = 0;
        }
    }

    connect(wsURL) {
        if (this.#connection) {
            this.#connection.close();
            this.#lastTime = 0;
            this.#connection = null;
        }
        this.trace('create', null, {
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
            reloadCount: this.#reloadCount,
        });
        this.#connectionStartTime = Date.now();
        this.#connection = new WebSocket(wsURL, 'rtcstats#' + PROTOCOL_VERSION);
        this.#connection.addEventListener('error', (e) => {
            if (this.#config.log) {
                this.#config.log('rtcstats websocket connection error', e, this.#connection.readyState);
            }
        });

        this.#connection.addEventListener('close', (e) => {
            if (e.code === 1008 && this.#config.log) {
                this.#config.log('rtcstats websocket connection closed with error=1008. ' +
                           'Typically this means authorization is required and failed.');
            }
            // reconnect?
        });

        this.#connection.addEventListener('open', () => {
            // Note: open is called while the socket is still authenticating.
            // This can lead to messages being send and dropped when the token
            // is not valid.
            const connectionTime = Date.now() - this.#connectionStartTime;
            const flush = () => {
                if (!this.#buffer.length) {
                    this.trace('websocket', null, {
                        connectionTime,
                    });
                    return;
                }
                if (this.#connection.readyState !== WebSocket.OPEN) {
                    return;
                }
                this.#connection.send(JSON.stringify(this.#buffer.shift()));
                setTimeout(flush, 0);
            };
            setTimeout(flush, 0);
        });

        this.#connection.addEventListener('message', (msg) => {
            // no messages from the server defined yet.
        });
    }
}

export function WebSocketTrace(config = {}) {
    const tracer = new WebSocketTracer(config);
    const trace = tracer.trace.bind(tracer);
    trace.close = tracer.close.bind(tracer);
    trace.connect = tracer.connect.bind(tracer);
    return trace;
}
