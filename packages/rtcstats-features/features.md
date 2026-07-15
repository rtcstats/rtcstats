# Features

This document describes the features extracted by the three feature extractors in this directory:

* [`client.js`](./features/client.js): `extractClientFeatures(clientTrace)`
* [`connection.js`](./features/connection.js): `extractConnectionFeatures(clientTrace, peerConnectionTrace)`
* [`track.js`](./features/track.js): `extractTrackFeatures(clientTrace, peerConnectionTrace, trackInformation)`

## Relationship between client, connection and track features

A single rtcstats dump consists of a `clientTrace` (events not associated with any peer connection,
e.g. `getUserMedia`, `enumerateDevices`, the rtcstats-js websocket) and one or more
`peerConnectionTrace`s (events scoped to a single `RTCPeerConnection`, e.g. `createOffer`,
`onicecandidate`, periodic `getStats` reports). Within a `peerConnectionTrace`, individual media
tracks are identified by their `statsId` (the key of their `inbound-rtp` or `outbound-rtp` entry
in the `getStats` report).

Feature extraction follows the same hierarchy:

```
client (1)
└── connection (1..N)        (one per RTCPeerConnection)
    └── track (0..N)         (one per inbound/outbound media track)
```

* **Client features** describe the page/process. They are extracted from the `clientTrace` only.
* **Connection features** describe a single peer connection. They are extracted from one
  `peerConnectionTrace` (the `clientTrace` is currently passed but unused).
* **Track features** describe a single inbound or outbound media track on a connection. They
  are extracted from the same `peerConnectionTrace` filtered by the track's `statsId`, plus a
  `trackInformation` descriptor (`{id, kind, direction, startTime, statsId}`) produced by
  `parseTrackWithStreams` from `@rtcstats/rtcstats-shared`.

This mirrors the database layout described in [`README.md`](./README.md): one
`features_client` row per dump, many `features_connection` rows per dump, and many
`features_track` rows per connection.

## W3C specifications

Most features map directly onto W3C-defined APIs and stats. The two relevant specs are:

* [WebRTC 1.0: Real-Time Communication Between Browsers](https://w3c.github.io/webrtc-pc/) (the peer connection spec): defines `RTCPeerConnection`, the offer/answer methods, ICE/connection state machines, candidate handling, and `RTCConfiguration`.
* [Identifiers for WebRTC's Statistics API](https://w3c.github.io/webrtc-stats/) (the stats spec): defines the `getStats()` report dictionaries used by the `*getStats*` sources below. The dictionaries referenced in this document are:
  * [`RTCTransportStats`](https://w3c.github.io/webrtc-stats/#transportstats-dict*) (DTLS, SRTP).
  * [`RTCIceCandidatePairStats`](https://w3c.github.io/webrtc-stats/#candidatepair-dict*) (selected pair, RTT).
  * [`RTCIceCandidateStats`](https://w3c.github.io/webrtc-stats/#icecandidate-dict*) (local/remote candidates).
  * [`RTCInboundRtpStreamStats`](https://w3c.github.io/webrtc-stats/#inboundrtpstats-dict*) (inbound track stats).
  * [`RTCOutboundRtpStreamStats`](https://w3c.github.io/webrtc-stats/#outboundrtpstats-dict*) (outbound track stats).
  * [`RTCRemoteInboundRtpStreamStats`](https://w3c.github.io/webrtc-stats/#remoteinboundrtpstats-dict*) (L4S remote-side fields).
  * [`RTCCodecStats`](https://w3c.github.io/webrtc-stats/#codec-dict*) (codec MIME / fmtp).

## Source tags

Each feature table has a **Source** column with one of these tags:

* `presence`: boolean, `true` if any matching trace event exists.
* `count`: number, count of matching trace events.
* `first event`: a value taken from the first matching trace event.
* `last event`: a value taken from the last matching trace event.
* `time delta`: difference between two trace event timestamps.
* `create event`: value copied from the `create` event's `value` (a single snapshot at creation time).
* `first getStats`: a value from the first `getStats` report whose entries satisfy a predicate.
* `last getStats`: a value from the last `getStats` report whose entries satisfy a predicate.
* `last getStats ratio`: a ratio of two fields read from the last matching `getStats` report.
* `aggregated getStats`: computed across every `getStats` report containing the track's entry (mode/min/max).

Counters in WebRTC `getStats` (e.g. `framesEncoded`, `nackCount`, `jitterBufferDelay`) are cumulative since session start, so reading them from the last report yields the lifetime total.

---

## Client features (`client.js`)

Client features describe the client as a whole, independent of any particular [`RTCPeerConnection`](https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection).
There are no `getStats` reports in the `clientTrace`; everything is derived from API trace events.

### Top-level fields

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `startTime` | number | first event | Timestamp (ms) at which the rtcstats dump was started. The first trace event's timestamp. |
| `duration` | number | time delta | Lifetime of the client in milliseconds (last event timestamp minus first). |
| `userAgentData` | object | create event | UA / UA-CH information captured at dump start. |
| `hardwareConcurrency` | number | create event | `navigator.hardwareConcurrency`. |
| `deviceMemory` | number | create event | `navigator.deviceMemory`. |
| `screen` | object | create event | Screen metadata (e.g. resolution). |
| `window` | object | create event | Window metadata (e.g. inner size). |
| `reloadCount` | number | create event | Number of times the page has been reloaded, if reported. |

Any other fields present on the `create` event's `value` are also spread into the result.

### `getUserMedia`

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `calledGetUserMedia` | boolean | presence | Whether `getUserMedia` was called at least once. |
| `calledGetUserMediaAudio` | boolean | presence | Whether `getUserMedia` was called requesting audio (`value.audio !== false`). |
| `calledGetUserMediaVideo` | boolean | presence | Whether `getUserMedia` was called requesting video (`value.video !== false`). |
| `calledGetUserMediaCombined` | boolean | presence | Whether a single `getUserMedia` call requested both audio and video. |
| `getUserMediaError` | string | first event | Error name/value of the first failed `getUserMedia`. |
| `getUserMediaErrorCount` | number | count | Number of failed `getUserMedia` calls. |
| `getUserMediaSuccessCount` | number | count | Number of successful `getUserMedia` calls. |

### `getDisplayMedia`

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `calledGetDisplayMedia` | boolean | presence | Whether `getDisplayMedia` was called at least once. |
| `calledGetDisplayMediaAudio` | boolean | presence | Whether `getDisplayMedia` was called requesting audio (`value.audio !== false`). |
| `calledGetDisplayMediaVideo` | boolean | presence | Whether `getDisplayMedia` was called requesting video (`value.video !== false`). |
| `getDisplayMediaErrorCount` | number | count | Number of failed `getDisplayMedia` calls. |
| `getDisplayMediaSuccessCount` | number | count | Number of successful `getDisplayMedia` calls. |

### `enumerateDevices`

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `enumerateDevicesCount` | number | count | How often `enumerateDevices` was called. |

### WebSocket

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `webSocketConnectionTime` | number | first event | Connection time (ms) reported by rtcstats-js for its upload websocket. `value.connectionTime` of the first `websocket` event. |

### Tracks (not bound to a peer connection)

Tracks from `getUserMedia` are matched by id between
`navigator.mediaDevices.getUserMediaOnSuccess` and `MediaStreamTrack.onended`. Field names are
prefixed with the track `kind` (e.g. `audio`, `video`).

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `<kind>Ended` | boolean | presence | A track of that kind fired `onended` during the trace. |
| `<kind>ShortDuration` | boolean | time delta | A track of that kind ended less than 1000ms after `getUserMediaOnSuccess` for the same id. |

Both fields are absent (rather than `false`) when the corresponding condition is not met.

---

## Connection features (`connection.js`)

Connection features describe a single [`RTCPeerConnection`](https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection). Most are derived from the API trace
(`createOffer`, `setLocalDescription`, `onicecandidate`, `onconnectionstatechange`, etc., all defined in [webrtc-pc](https://w3c.github.io/webrtc-pc/)); a
handful come from periodic [`getStats`](https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection-getstats) reports embedded in the trace.

### Top-level fields

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `startTime` | number | first event | Timestamp of the first event in the peer connection trace. |
| `duration` | number | time delta | Lifetime of the peer connection in milliseconds. |
| `closed` | boolean | last event | Whether `pc.close()` was called (the last event's type is `close`). |
| `numberOfEvents` | number | trace length | Total number of events in the peer connection trace. |
| `numberOfEventsNotGetStats` | number | count | Number of events excluding periodic `getStats`. |
| `numberOfNegotiations` | number | count | Number of signaling state changes to `stable`, i.e. completed negotiations including rollbacks. |
| `pendingNegotiationAtEnd` | boolean | last signaling state | Whether the connection ended mid-negotiation, i.e. the last signaling state before closing was not `stable`. |
| `signalingDelay` | number | time delta | First offer/answer round-trip time, from `setLocalDescription({type:'offer'})` to the first subsequent `setRemoteDescription({type:'answer'})`. |
| `clockSkew` | number | first getStats | Skew (ms) between the first `getStats` call time (`Date.now()`) and the `peer-connection` stats timestamp in that report. Large when the page was open across an OS suspend. |

### API failures

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `addIceCandidateFailure` | string | first event | Error message of the first failed `addIceCandidate` (`value` of the first `addIceCandidateOnFailure`). |
| `setLocalDescriptionFailure` | string | first event | Error message of the first failed `setLocalDescription`. |
| `setRemoteDescriptionFailure` | string | first event | Error message of the first failed `setRemoteDescription`. |

### `setLocalDescription` / `setRemoteDescription` timing

The call is paired with its `OnSuccess` event using the `extra` correlation id stored on both events.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `setLocalDescriptionDelay` | number | time delta | Time (ms) the first `setLocalDescription` call took to resolve. |
| `setLocalDescriptionRole` | string | first event | `value.type` of that first `setLocalDescription` (`offer` or `answer`). |
| `setRemoteDescriptionDelay` | number | time delta | Time (ms) the first `setRemoteDescription` call took to resolve. |
| `setRemoteDescriptionRole` | string | first event | `value.type` of that first `setRemoteDescription` (`offer` or `answer`). |

### DTLS / connection state

DTLS fields are read from the [`RTCTransportStats`](https://w3c.github.io/webrtc-stats/#transportstats-dict*) dictionary; see [`dtlsRole`](https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-dtlsrole), [`tlsVersion`](https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-tlsversion) and [`srtpCipher`](https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-srtpcipher). [`connectionState`](https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnectionstate) is defined in webrtc-pc.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `connected` | boolean | presence | Whether `connectionState` reached `'connected'` at least once. |
| `connectionTime` | number | time delta | Time (ms) to complete the DTLS handshake (`connectionState='connecting'` to `'connected'`). |
| `dtlsRole` | string | first getStats | DTLS role from the first `transport` stats entry that has a `tlsVersion`. Set after O/A. |
| `dtlsVersion` | string | first getStats | DTLS version (`tlsVersion`) from that same transport entry. Requires the handshake to be complete. |
| `srtpCipher` | string | first getStats | SRTP cipher (derived from DTLS) from that same transport entry. |

### ICE state and signaling

[`iceConnectionState`](https://w3c.github.io/webrtc-pc/#dom-rtciceconnectionstate) and the [ICE restart](https://w3c.github.io/webrtc-pc/#dom-rtcofferoptions-icerestart) flag are defined in webrtc-pc.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `iceConnected` | boolean | presence | Whether ICE state reached `'connected'` at least once. |
| `iceConnectionTime` | number | time delta | Time (ms) for ICE checks to complete (`iceConnectionState='checking'` to `'connected'`). |
| `iceRestart` | boolean | presence | Whether a local ICE restart was attempted (`createOffer({iceRestart: true})`). |
| `iceRestartFollowedBySetRemoteDescription` | boolean | presence | Whether the ICE restart completed the offer/answer exchange (followed by `setLocalDescription({type:'offer'})` then `setRemoteDescription({type:'answer'})`). |
| `usingIceLite` | boolean | presence | Whether the remote peer is ICE-lite, typically a server (a remote SDP contains `a=ice-lite`). |

### Configured ICE servers

All fields are derived from the [`RTCConfiguration`](https://w3c.github.io/webrtc-pc/#dom-rtcconfiguration) (specifically [`iceServers`](https://w3c.github.io/webrtc-pc/#dom-rtcconfiguration-iceservers) and [`iceTransportPolicy`](https://w3c.github.io/webrtc-pc/#dom-rtcconfiguration-icetransportpolicy)) captured in the `create` event. Absent if the configuration has no `iceServers`.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `configuredIceServers` | number | create event | Number of entries in `configuration.iceServers`. |
| `configuredIceTransportPolicy` | boolean | create event | Whether `iceTransportPolicy === 'relay'` (forced relay). |
| `configuredIceServersStun` | boolean | create event | At least one `stun:` URL was configured. |
| `configuredIceServersTurns` | boolean | create event | At least one `turns:` URL was configured. |
| `configuredIceServersTurnUdp` | boolean | create event | At least one `turn:...?transport=udp` URL was configured. |
| `configuredIceServersTurnTcp` | boolean | create event | At least one `turn:...?transport=tcp` URL was configured. |

### Added / gathered candidates

`added*` look at `addIceCandidate` calls (remote candidates given to us). `gathered*` look at
`onicecandidate` events (local candidates we produced). Candidate types are parsed with
`SDPUtils.parseCandidate`.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `addedHostCandidate` | boolean | presence | A `host` candidate was added. |
| `addedMdnsCandidate` | boolean | presence | An mDNS `host` candidate was added (address ending in `.local`). |
| `addedSrflxCandidate` | boolean | presence | A `srflx` candidate was added. |
| `addedTurnCandidate` | boolean | presence | A `relay` candidate was added. |
| `addedNullCandidate` | boolean | presence | End-of-candidates was signalled by the remote (`addIceCandidate(null)`). |
| `gatheredHostCandidate` | boolean | presence | A `host` candidate was gathered locally. |
| `gatheredMdnsCandidate` | boolean | presence | An mDNS `host` candidate was gathered locally. |
| `gatheredSrflxCandidate` | boolean | presence | A `srflx` candidate was gathered locally. |
| `gatheredTurnCandidate` | boolean | presence | A `relay` candidate was gathered locally. |

### First selected candidate pair

All fields below come from the first `getStats` report taken after `onconnectionstatechange='connected'` whose [`transport`](https://w3c.github.io/webrtc-stats/#transportstats-dict*) has a [`selectedCandidatePairId`](https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-selectedcandidatepairid). Local and remote [`RTCIceCandidateStats`](https://w3c.github.io/webrtc-stats/#icecandidate-dict*) are looked up by id from the same report. Absent if no such report exists.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `firstCandidatePairLocalAddress` | string | first getStats | Local candidate address. |
| `firstCandidatePairLocalProtocol` | string | first getStats | Local candidate transport protocol (`udp`/`tcp`). |
| `firstCandidatePairLocalNetworkType` | string | first getStats | Local candidate network type (`vpn`, `wifi`, ...). |
| `firstCandidatePairLocalType` | string | first getStats | Local candidate type (`host`, `srflx`, `relay`, ...). |
| `firstCandidatePairLocalTypePreference` | number | first getStats | ICE type preference of the local candidate (top 8 bits of `priority`). |
| `firstCandidatePairLocalRelayProtocol` | string | first getStats | Relay protocol if the local candidate is a relay. |
| `firstCandidatePairLocalRelayUrl` | string | first getStats | TURN URL the relay was allocated from. |
| `firstCandidatePairRemoteAddress` | string | first getStats | Remote candidate address. |
| `firstCandidatePairRemoteType` | string | first getStats | Remote candidate type. |

### Last-stats averages

Computed from the selected [`RTCIceCandidatePairStats`](https://w3c.github.io/webrtc-stats/#candidatepair-dict*).

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `averageStunRoundTripTime` | number | last getStats ratio | Average STUN RTT over the connection's lifetime ([`totalRoundTripTime`](https://w3c.github.io/webrtc-stats/#dom-rtcicecandidatepairstats-totalroundtriptime) / [`responsesReceived`](https://w3c.github.io/webrtc-stats/#dom-rtcicecandidatepairstats-responsesreceived) on the selected candidate pair). |
| `averageOutboundBitrate` | number | last getStats ratio | Average outbound bitrate (bits/s) over the connection's lifetime: `(last.bytesSent - first.bytesSent) * 8 / (last.timestamp - first.timestamp)` on the selected candidate pair, where `first` is the earliest `getStats` report whose selected pair has non-zero `bytesSent` and `bytesReceived`. |
| `averageInboundBitrate` | number | last getStats ratio | Average inbound bitrate (bits/s) over the connection's lifetime: `(last.bytesReceived - first.bytesReceived) * 8 / (last.timestamp - first.timestamp)` on the selected candidate pair, with `first` defined as for `averageOutboundBitrate`. |

### Geolocation

Populated from the `extra[0].rtcstatsLocation` annotation that the server adds to candidate
events. Each tuple of fields is independent; any subset may be present. Requires the server to
have a geolocation database such as MaxMind configured.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `rtcstatsLocationContinent` | string | extra annotation | Continent of the local candidate that ended up in the selected pair. |
| `rtcstatsLocationCountry` | string | extra annotation | Country of the local candidate that ended up in the selected pair. |
| `rtcstatsLocationCity` | string | extra annotation | City of the local candidate that ended up in the selected pair. |
| `rtcstatsPeerLocationContinent` | string | extra annotation | Continent of the remote candidate that ended up in the selected pair. |
| `rtcstatsPeerLocationCountry` | string | extra annotation | Country of the remote candidate that ended up in the selected pair. |
| `rtcstatsPeerLocationCity` | string | extra annotation | City of the remote candidate that ended up in the selected pair. |
| `rtcstatsRelayLocationContinent` | string | extra annotation | Continent annotation found on any locally-gathered relay candidate. |
| `rtcstatsRelayLocationCountry` | string | extra annotation | Country annotation found on any locally-gathered relay candidate. |
| `rtcstatsRelayLocationCity` | string | extra annotation | City annotation found on any locally-gathered relay candidate. |

---

## Track features (`track.js`)

Track features describe a single inbound or outbound media track. The extractor takes a
`trackInformation` descriptor and pulls the track's `getStats` entry by `statsId` from each
`getStats` report in the peer connection trace.

### Top-level fields

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `kind` | string | trackInformation | Track kind (`'audio'` or `'video'`). |
| `direction` | string | trackInformation | Whether the track is being sent (`'outbound'`) or received (`'inbound'`). |
| `trackIdentifier` | string | trackInformation | The track's `id`. |
| `startTime` | number | trackInformation | Timestamp at which the track was added to the connection. |
| `hasNullVideoDecoder` | boolean | aggregated getStats | Whether the null video decoder was used at any point (`decoderImplementation === 'NullVideoDecoder'`). Inbound video only; otherwise `undefined`. |

### Codec

Read from [`RTCCodecStats`](https://w3c.github.io/webrtc-stats/#codec-dict*) referenced by the track entry's `codecId`.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `codecMimeType` | string | first getStats | MIME type of the codec used ([`codec.mimeType`](https://w3c.github.io/webrtc-stats/#dom-rtccodecstats-mimetype) from the first report that has both the track's stats entry and a `codec` entry referenced by `codecId`). |
| `codecSdpFmtpLine` | string | first getStats | SDP `fmtp` parameters ([`codec.sdpFmtpLine`](https://w3c.github.io/webrtc-stats/#dom-rtccodecstats-sdpfmtpline)); `''` if missing. |

### Resolution (video only)

All fields are aggregated across every `getStats` report containing a `frameWidth` and `frameHeight` for this track. Audio tracks return no resolution fields.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `commonWidth` | number | aggregated getStats | Most frequently observed width (mode). |
| `commonHeight` | number | aggregated getStats | Most frequently observed height (mode). |
| `minWidth` | number | aggregated getStats | Smallest observed width. |
| `minHeight` | number | aggregated getStats | Smallest observed height. |
| `maxWidth` | number | aggregated getStats | Largest observed width. |
| `maxHeight` | number | aggregated getStats | Largest observed height. |

### Last-stats features (both directions)

All fields below are read from the last `getStats` report containing the track's stats entry: [`RTCInboundRtpStreamStats`](https://w3c.github.io/webrtc-stats/#inboundrtpstats-dict*) for inbound, [`RTCOutboundRtpStreamStats`](https://w3c.github.io/webrtc-stats/#outboundrtpstats-dict*) for outbound. Counters are cumulative since the track started, so the last value is the lifetime total.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `duration` | number | time delta | Approximate active duration of the track in ms (`floor(lastStats.timestamp - track.startTime)`; `0` if no stats). |
| `frameCount` | number | last getStats | Cumulative frame count: `framesEncoded` (outbound) or `framesDecoded` (inbound). |
| `keyFrameCount` | number | last getStats | Cumulative key frame count: `keyFramesEncoded` (outbound) or `keyFramesDecoded` (inbound). |
| `qpSum` | number | last getStats | Cumulative sum of QP values. |
| `nackCount` | number | last getStats | Cumulative count of NACK packets. |
| `pliCount` | number | last getStats | Cumulative count of PLI packets. |
| `firCount` | number | last getStats | Cumulative count of FIR packets. |

### Outbound-only

All fields below are read from the last `getStats` report containing the track's [`outbound-rtp`](https://w3c.github.io/webrtc-stats/#outboundrtpstats-dict*) entry. The L4S `packetsReceived*` and `packetsWith*` fields come from the linked [`remote-inbound-rtp`](https://w3c.github.io/webrtc-stats/#remoteinboundrtpstats-dict*) entry (looked up via `outboundRtp.remoteId` in the same report).

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `averageEncodeTime` | number | last getStats ratio | Average encode time per frame (`totalEncodeTime / framesEncoded`). |
| `bandwidthQualityLimitationPercentage` | number | last getStats ratio | Fraction of time the encoder was bandwidth-limited (`qualityLimitationDurations.bandwidth / sum(qualityLimitationDurations)`). |
| `cpuQualityLimitationPercentage` | number | last getStats ratio | Fraction of time the encoder was CPU-limited. |
| `otherQualityLimitationPercentage` | number | last getStats ratio | Fraction of time the encoder was limited by `other`. |
| `qualityLimitationResolutionChanges` | number | last getStats | Cumulative count of resolution changes triggered by quality limitations. |
| `rid` | string | last getStats | Simulcast layer rid. Used to group simulcast layers. |
| `encodingIndex` | number | last getStats | Simulcast layer index. Used to group simulcast layers. |
| `encoderImplementation` | string | last getStats | Encoder implementation name (HW vs SW indicator). |
| `powerEfficientEncoder` | boolean | last getStats | Whether the encoder is power-efficient. |
| `psnrMeasurements` | number | last getStats | Cumulative number of PSNR measurements (only set if reported). |
| `psnrSumY` / `psnrSumU` / `psnrSumV` | number | last getStats | Per-plane cumulative PSNR sums (`psnrSum.y` / `.u` / `.v`; only set if `psnrMeasurements` is reported). |
| `packetsSentWithEct1` | number | last getStats | L4S: cumulative packets sent with the ECT(1) ECN codepoint. |
| `packetsReceivedWithEct1` | number | last getStats | L4S: cumulative packets received with ECT(1) (from the linked `remote-inbound-rtp`). |
| `packetsReceivedWithCe` | number | last getStats | L4S: cumulative packets received with the CE (congestion-experienced) marking (from the linked `remote-inbound-rtp`). |
| `packetsWithBleachedEct1Marking` | number | last getStats | L4S: cumulative packets whose ECT(1) marking was cleared in transit (from the linked `remote-inbound-rtp`). |

### Inbound-only

All fields below are read from the last `getStats` report containing the track's [`inbound-rtp`](https://w3c.github.io/webrtc-stats/#inboundrtpstats-dict*) entry. Cumulative counters give lifetime totals; the `average*` fields are ratios computed from those last-report values.

| Feature | Type | Source | Description |
| --- | --- | --- | --- |
| `freezeCount` | number | last getStats | Cumulative number of video freezes. |
| `totalFreezesDuration` | number | last getStats | Cumulative duration of freezes. |
| `framesDropped` | number | last getStats | Cumulative frames dropped before rendering. |
| `decoderImplementation` | string | last getStats | Decoder implementation name. |
| `powerEfficientDecoder` | boolean | last getStats | Whether the decoder is power-efficient. |
| `jitterBufferDelay` | number | last getStats | Cumulative jitter buffer delay. |
| `jitterBufferMinimumDelay` | number | last getStats | Cumulative jitter buffer minimum target delay. |
| `jitterBufferTargetDelay` | number | last getStats | Cumulative jitter buffer target delay. |
| `jitterBufferEmittedCount` | number | last getStats | Cumulative frames/samples emitted by the jitter buffer. |
| `jitterBufferFlushes` | number | last getStats | Cumulative number of times the [jitter buffer was flushed](https://w3c.github.io/webrtc-stats/#dom-rtcinboundrtpstreamstats-jitterbufferflushes). |
| `hasPeriodicJitterBufferFlushes` | boolean | aggregated getStats | Whether `jitterBufferFlushes` increments at a regular roughly-four-second cadence (a known NetEq pathology), detected from at least three increments (audio only). |
| `totalProcessingDelay` | number | last getStats | Cumulative processing delay. |
| `framesAssembledFromMultiplePackets` | number | last getStats | Cumulative frames that required multiple packets to assemble. |
| `totalAssemblyTime` | number | last getStats | Cumulative time spent assembling frames from packets. |
| `averageDecodeTime` | number | last getStats ratio | Average decode time per frame (`totalDecodeTime / framesDecoded`). |
| `averageInterFrameDelay` | number | last getStats ratio | Average inter-frame delay (`totalInterFrameDelay / framesDecoded`). |
| `averageJitterBufferDelay` | number | last getStats ratio | Average jitter buffer delay per emitted frame/sample (`jitterBufferDelay / jitterBufferEmittedCount`). |
| `averageProcessingDelay` | number | last getStats ratio | Average processing delay per emitted frame/sample (`totalProcessingDelay / jitterBufferEmittedCount`). |
| `averageAssemblyTime` | number | last getStats ratio | Average assembly time per multi-packet frame (`totalAssemblyTime / framesAssembledFromMultiplePackets`). |
| `concealedSamples` | number | last getStats | Cumulative number of [concealed audio samples](https://w3c.github.io/webrtc-stats/#dom-rtcinboundrtpstreamstats-concealedsamples) generated by the decoder (audio only). |
| `totalSamplesReceived` | number | last getStats | Cumulative number of [audio samples received](https://w3c.github.io/webrtc-stats/#dom-rtcinboundrtpstreamstats-totalsamplesreceived), including concealed ones (audio only). |
| `concealmentPercentage` | number | last getStats ratio | Fraction of received audio samples that were concealed (`concealedSamples / totalSamplesReceived`; audio only). |
| `insertedSamplesForDeceleration` | number | last getStats | Cumulative number of [samples inserted](https://w3c.github.io/webrtc-stats/#dom-rtcinboundrtpstreamstats-insertedsamplesfordeceleration) by NetEq to slow playout (audio only). |
| `removedSamplesForAcceleration` | number | last getStats | Cumulative number of [samples removed](https://w3c.github.io/webrtc-stats/#dom-rtcinboundrtpstreamstats-removedsamplesforacceleration) by NetEq to speed up playout (audio only). |
| `decelerationPercentage` | number | last getStats ratio | Fraction of received audio samples that were inserted by NetEq to slow playout (`insertedSamplesForDeceleration / totalSamplesReceived`; audio only). |
| `accelerationPercentage` | number | last getStats ratio | Fraction of received audio samples that were removed by NetEq to speed up playout (`removedSamplesForAcceleration / totalSamplesReceived`; audio only). |
