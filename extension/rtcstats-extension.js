// npx webpack-cli ./rtcstats-extension.js
import {wrapRTCPeerConnection, wrapGetUserMedia, wrapEnumerateDevices, WebSocketTrace } from '../packages/rtcstats-js';

const trace = new WebSocketTrace();

wrapRTCPeerConnection(trace, window, {getStatsInterval: 1000});
wrapGetUserMedia(trace, window);
wrapEnumerateDevices(trace, window);
trace.connect('ws://localhost:8080' + window.location.pathname);
