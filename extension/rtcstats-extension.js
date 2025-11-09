// npx webpack-cli ./rtcstats-extension.js
import {wrapRTCPeerConnection, wrapGetUserMedia, wrapEnumerateDevices } from '../packages/rtcstats-js';
import {IndexedDBTrace} from './trace-indexeddb.js';

const sessionId = 'session-' + Date.now();
const trace = new IndexedDBTrace();

wrapRTCPeerConnection(trace, window, {getStatsInterval: 1000});
wrapGetUserMedia(trace, window);
wrapEnumerateDevices(trace, window);
trace.connect(sessionId);

window.rtcstatsDownload = async () => {
    const blob = await trace.getBlob(sessionId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionId}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
};

// You can list all sessions calling await trace.list()
