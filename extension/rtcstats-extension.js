// npx webpack-cli ./rtcstats-extension.js
import {wrapRTCPeerConnection, wrapGetUserMedia, wrapEnumerateDevices } from '../packages/rtcstats-js';
import {IndexedDBTrace} from './trace-indexeddb.js';

const trace = new IndexedDBTrace();

wrapRTCPeerConnection(trace, window, {getStatsInterval: 1000});
wrapGetUserMedia(trace, window);
wrapEnumerateDevices(trace, window);

window.rtcstatsDownload = async () => {
    await trace.download();
};
