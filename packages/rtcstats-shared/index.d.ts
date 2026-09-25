// Type definitions for @rtcstats/rtcstats-shared

export function maybeUncompressDump(blob: Blob): Promise<Blob>;
export function detectWebRTCInternalsDump(blob: Blob): Promise<boolean>;
export function readWebRTCInternalsDump(blob: Blob): Promise<object>;
export function detectRTCStatsDump(blob: Blob): Promise<boolean>;
export function readRTCStatsDump(blob: Blob): Promise<object>;
export function internalsToRtcstats(data: object): object;
export function readDump(blob: Blob): Promise<object>;
export function extractTracks(peerConnectionTrace: any[]): Promise<any[]>;

export function statsCompression(baseStatsInput: object | RTCStatsReport, newStatsInput: object | RTCStatsReport, statsIdMap: object): object;
export function statsDecompression(baseStatsInput: object, delta: object): object;
export function descriptionCompression(baseDescription: RTCSessionDescription, newDescription: RTCSessionDescription): RTCSessionDescriptionInit;
export function descriptionDecompression(baseDescription: RTCSessionDescription, newDescription: RTCSessionDescription): RTCSessionDescriptionInit;
export function compressMethod(method: string): string | number;
export function decompressMethod(methodKey: string | number): string;
export function compressStatsType(type: string): string | number;
export function decompressStatsType(typeKey: string | number): string;
export function compressStatsProperty(property: string): string | number;
export function decompressStatsProperty(property: string | number): string;
export const computePressureTable: {nominal: number, fair: number, serious: number, critical: number};

export function createInternalsTimeSeries(connection: any): object;
export function createRtcStatsTimeSeries(trace: any[]): object;
export function insertNullForGapsIntoTimeSeries(timeSeries: any[], gapSizeMs?: number): any[];

export function map2obj(m: Map<any, any> | object): object;
export function dumpTrackWithStreams(track: MediaStreamTrack, ...streams: MediaStream[]): string[];
export function parseTrackWithStreams(serialized: any[]): object;
export function copyAndSanitizeConfig(config: RTCConfiguration): object;
