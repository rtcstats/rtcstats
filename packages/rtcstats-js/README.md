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

### Tracing custom events
Sometimes you may want to send your own events to RTCStats to have them all in one dump file.
This can be accomplished with the `trace` function as well. The method signature for this is
```
trace(method name, e.g. `:userRating`,
      peerconnection object to associate with or null if not associated,
      javascript object with data or string)
```

* The first argument is the method name MUST start with a colon (`:`) to avoid conflicts with any method names that rtcstats-js and rtcstats-server use internally.
* If the event is to be associated with a particular RTCPeerConnection, pass that connection as the second argument.
  If it is not, e.g. for an end-of-call user rating, pass `null`.
* The third argument can be a Javascript string or object which will be encoded using JSON when sent to the server. If there is no additional data, pass `null`.
* The trace function will internally add a timestamp to the event.
* rtcstats-server will not process such events by default.
* A dump-importer should still display a generic rendering of the event.

### Using a JWT to connect to rtcstats-server
See [the server README](https://github.com/rtcstats/rtcstats/blob/main/packages/rtcstats-server/README.md) for how to
generate JWT token with information about the user, session and conference.

If the server is configured to require an authorization token, the websocket will
be closed with a 1008 policy-violation error which can be seen when configuring the logging callback:
```
const trace = new WebSocketTrace({log: console.warn.bind(console)});
```

### Bundling
To bundle rtcstats-js including its dependencies, use
```
npx webpack --entry ./packages/rtcstats-js/rtcstats.js --output-path ./packages/rtcstats-js/dist --output-filename rtcstats.bundle.js --mode production --output-library rtcstats
```
then include the resulting bundle which is exported as the global `rtcstats` object:
```
<script type="text/javascript" src="rtcstats.bundle.js"></script>
<script type="text/javascript">
const trace = rtcstats.wrapRTCStatsWithDefaultOptions();
// Do something.
</script>
```

### Ending a session
RTCStats sessions create a single dump file for every websocket connection. For long-running pages it may be required
to close the websocket when a "session" is done and reconnect (possibly with a new JWT):
```
trace.connect('ws://localhost:8080/?rtcstats-token=token-1');
// Do something
trace.close()

// Reconnect.
trace.connect('ws://localhost:8080/?rtcstats-token=token-2');
```
Note that RTCStats is not keeping track of whether all RTCPeerConnections have been closed and track  from getUserMedia/getDisplayMedia
have been stopped.

### See also
See also the [end-to-end example](/example/) in `example/` directory and
the (internal) API docs [here](docs/index.md).

