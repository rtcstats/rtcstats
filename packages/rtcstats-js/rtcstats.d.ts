export interface Trace {
    (method: string, pcId: string | RTCPeerConnection | null, ...args: any[]): void;
    connect(target: string): void | Promise<void>;
    close(): void | Promise<void>;
}

export const WebSocketTrace: {
    new (config?: object): Trace;
    (config?: object): Trace;
};

export function wrapRTCStatsWithDefaultOptions(config?: object, window?: object): Trace;

export function wrapRTCPeerConnection(trace: Trace, window: object, config: object): void;
export function wrapGetUserMedia(trace: Trace, window: object, config?: object): void;
export function wrapEnumerateDevices(trace: Trace, window: object, config?: object): void;
export function wrapSetSinkId(trace: Trace, window: object): void;

export function getClientMetadata(): object;
