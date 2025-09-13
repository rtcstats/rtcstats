# rtcstats monorepo

This is a monorepo for rtcstats-js (clientside monitoring), rtcstats-server (serverside dump collection)
and the updated dump-importer (supporting rtcstats and webrtc-internals formats).

It is part of a bigger offering that includes [rtcstats.com](https://rtcstats.com),
an online service for debugging and troubleshooting WebRTC statistics.

See the individual README files for details (soon):
* [dump-importer](dump-importer/README.md)

# End-to-end example

To start the local example version, run
```
npm install
npm start --workspace=example
```
This will start a minimal server, open a browser window, run some WebRTC-related API calls.
Once done, a RTCStats dump file can be found in the example/upload/ directory which can be imported
on RTCStats or the built-in dump importer.

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
import {wrapRTCPeerConnection} from '@rtcstats/rtcstats-js';
import {wrapGetUserMedia, wrapEnumerateDevices} from '@rtcstats/rtcstats-js';
import {WebSocketTrace} from '@rtcstats/rtcstats-js';

// Instantiate a trace function, e.g. as an instance of the Websocket trace.
const trace = WebSocketTrace();

// Wrap RTCPeerConnection-related APIs and events
wrapRTCPeerConnection(trace, window, {getStatsInterval: 1000});
// Wrap getUserMedia, getDisplayMedia and related events.
wrapGetUserMedia(trace, window);
// Wrap enumerateDevices.
wrapEnumerateDevices(trace, window);

// Connect to the rtcstats-server instance.
trace.connect('ws://localhost:8080' + window.location.pathname);

const pc = new RTCPeerConnection();
```

See also the [end-to-end example](/example/) in `example/` directory and
the (internal) API docs [here](packages/rtcstats-js/docs/index.md).

# rtcstats-server

The server listens on a WebSocket and writes the incoming data (the "dump") to a temporary file.
If configured, the dump file is uploaded to storage (S3 or compatible) and metadata is
written to a database (postgres or compatible). See [below](#rtcstats-dump-file-format) for
a formal specification of the dump file format.

Compared to previous iterations of rtcstats-server, feature extraction is currently not supported.

## Usage with Docker
See the Dockerfile in the toplevel directory.

# RTCStats dump file format

RTCStats dump files are line-oriented JSON as described in [JSON Lines](https://jsonlines.org/).

This section described the file format in **version 3**. See below for older file formats and upgrading
Breaking changes to the file format require an upgrade plan.

RTCStats dump files may be compressed using standard compression methods such as gzip, bzip or brotli.
* WebRTC domain specific compression such as method compression or stats property compression MUST be supported by importers and MAY be used by clients.
* getStats delta compression MUST be supported by importers and MAY be used by clients.

The first line of every file is `RTCStatsDump` followed by a new line and a JSON object with metadata.
*  At minimum that line must include the "fileFormat" property with an integer value specifying the file format version.

Every line after this is a JSON array with RTCStats events.
* Usually four elements but some methods have additional elements.
* First element is the method name, e.g. `setLocalDescription`
  * This may be compressed using a static table
* Second element is the peerconnection id or `null` if this is not related to a peerconnection.
  * E.g. getUserMedia-related events are not associated with a peerconnection
* Third element is the arguments to the call or the event.
  * The value type and format depend on the method name
  * For most events it is either an array with the arguments to the API call serialized as an array. If the method has only a single argument this will be used as-is
* There may be additional elements
  * E.g. a correlation id to associate a call to setLocalDescription with a call to its corresponding setLocalDescriptionOnSuccess. For events related to RTCRtpTransceiver or RTCRtpSender an object identifier.
* The last element is the timestamp delta in milliseconds at which the event was generated by the client, given as a UNIX timestamp (this means the first delta is relative to the UNIX epoch).
* Personally identifiable information SHOULD be obfuscated
    * Servers SHOULD do obfuscation, clients MAY.
    * E.g. IP addresses on SDP, onicecandidate, addIceCandidate or statistics.
    * Device labels from enumerateDevices or getUserMediaOnSuccess

## Old versions
Versions 1 and 2 were used by the legacy RTCStats server. They are not supported.

# Building

Running
```
npm test
```
will run linting and unit/e2e tests in all sub-packages.

# Previous versions

This repository contains the current version of the legacy
[rtcstats-js](https://github.com/fippo/rtcstats) and [rtcstats-server](https://github.com/fippo/rtcstats-server).
The old versions are no longer maintained, friendly forks such as the [Jitsi one](https://github.com/jitsi/rtcstats) exist.

We invite you to use this version. We plan on keeping it well maintained, modernized and well behaved for all WebRTC applications.
