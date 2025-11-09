// Type definitions for @rtcstats/rtcstats-shared

export async function detectWebRTCInternalsDump(blob: Blob): Promise<boolean>;
export async function readWebRTCInternalsDump(blob: Blob): Promise<object>;
export async function detectRTCStatsDump(blob: Blob): Promise<boolean>;
export async function readRTCStatsDump(blob: Blob): Promise<object>;
export async function extractTracks(peerConnectionTrace: any[]): Promise<any[]>;

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

export function createInternalsTimeSeries(connection: any): object;
export function createRtcStatsTimeSeries(trace: any[]): object;
export function insertNullForGapsIntoTimeSeries(timeSeries: any[], gapSizeMs?: number): any[];

export function map2obj(m: Map<any, any> | object): object;
export function dumpTrackWithStreams(track: MediaStreamTrack, ...streams: MediaStream[]): string[];
export function parseTrackWithStreams(serialized: any[]): object;
export function copyAndSanitizeConfig(config: RTCConfiguration): object;
