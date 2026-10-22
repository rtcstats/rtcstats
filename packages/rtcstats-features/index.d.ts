// Type definitions for @rtcstats/rtcstats-features

export function extractClientFeatures(clientTrace: any[]): object;
export function extractConnectionFeatures(clientTrace: any[], peerConnectionTrace: any[]): object;
export function extractTrackFeatures(clientTrace: any[], peerConnectionTrace: any[], trackInformation: object): object;
