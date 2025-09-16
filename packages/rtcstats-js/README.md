This is part of the [monorepo](https://github.com/rtcstats/rtcstats) for rtcstats-js
(clientside monitoring), rtcstats-server (serverside dump collection) and the updated
dump-importer (supporting rtcstats and webrtc-internals formats).

It is part of a bigger offering that includes [rtcstats.com](https://rtcstats.com),
an online service for debugging and troubleshooting WebRTC statistics.

# rtcstats-js: A Javascript client SDK for monitoring WebRTC

The Javascript SDK provides low-level logging on peerconnection API calls and periodic getStats calls for analytics/debugging purposes.
It was designed to add a negligible overhead to the application’s performance with minimal integration efforts and remains
inspired by chrome's [webrtc-internals](https://bloggeek.me/webrtc-internals/) page.

This repository is the current iteration of the [2015 rtcstats.js](https://github.com/fippo/rtcstats). The principle is still the same:
* Transparent integration by overriding RTCPeerConnection et al with techniques used by adapter.js
* Trace all RTCPeerConnection and getUserMedia API calls and events.
* Send them to a server over Websocket.

## Usage

The main rtcstats.js exports a number of methods that facilitate this:
* `WebSocketTrace` instantiates a trace function that is passed to the other methods. It connects to a server over WebSocket.
* `wrapRTCPeerConnection` wraps RTCPeerConnection and related APIs on the supplied `window`
  object and generates traces using the supplied `trace` method.
* `wrapGetUserMedia` and `wrapEnumerateDevices` do the same for the `getUserMedia`/`getDisplayMedia`,
  `enumerateDevices` and related APIs such as MediaStreamTracks and HTMLVideoElement.

Typical usage looks like this:
```
import {wrapRTCStatsWithDefaultOptions} from '@rtcstats/rtcstats-js';

// Instantiate a trace function, using the helper with default options.
// See the example for a more fine-grained approach to wrapping.
const trace = wrapRTCStatsWithDefaultOptions();

// Connect to the rtcstats-server instance.
trace.connect('ws://localhost:8080' + window.location.pathname);

const pc = new RTCPeerConnection();
```

See also the [end-to-end example](/example/) in `example/` directory and
the (internal) API docs [here](docs/index.md).

