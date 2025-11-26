## Functions

<dl>
<dt><a href="#wrapTrackProperty">wrapTrackProperty(track, property, trace)</a></dt>
<dd><p>Wrap the setter for MediaStreamTrack.{property}.
Does not work on the prototype but needs a track instance.
Only done for local tracks where this is most useful.</p>
</dd>
<dt><a href="#wrapGetUserMedia">wrapGetUserMedia(trace, window)</a></dt>
<dd><p>Wraps getUserMedia and getDisplayMedia for RTCStats.
Legacy getUserMedia is not wrapped.
Also wraps these methods on MediaStreamTrack</p>
<ul>
<li>stop</li>
<li>applyConstraints
The <code>ended</code> event is wrapped as are the setters for <code>enabled</code>
and <code>contentHint</code>.</li>
</ul>
</dd>
<dt><a href="#wrapEnumerateDevices">wrapEnumerateDevices(trace, window)</a></dt>
<dd><p>Wraps enumerateDevices and the devicechange event for RTCStats.</p>
</dd>
<dt><a href="#wrapRTCRtpTransceiver">wrapRTCRtpTransceiver(trace, window)</a></dt>
<dd><p>Wraps a RTCRtpTransceiver for RTCStats. Currently applied to these methods:</p>
<ul>
<li>setCodecPreferences</li>
<li>setHeaderExtensionsToNegotiate</li>
</ul>
</dd>
<dt><a href="#wrapRTCRtpSender">wrapRTCRtpSender(trace, window)</a></dt>
<dd><p>Wraps a RTCRtpSenderfor RTCStats. Currently applied to these methods:</p>
<ul>
<li>setParameters</li>
<li>replaceTrack</li>
</ul>
</dd>
<dt><a href="#wrapRTCPeerConnection">wrapRTCPeerConnection(trace, window, configuration)</a></dt>
<dd><p>Wraps RTCPeerConnection for RTCStats.
Legacy methods and events are not wrapped.</p>
</dd>
<dt><a href="#wrapRTCStatsWithDefaultOptions">wrapRTCStatsWithDefaultOptions()</a> ⇒ <code>function</code></dt>
<dd><p>Wrap RTCStats WebSocket trace with default options.</p>
</dd>
<dt><a href="#statsCompression">statsCompression(baseStatsInput, newStatsInput, statsIdMap)</a> ⇒ <code>object</code></dt>
<dd><p>Apply compression to the stats report. Reduces size a lot.</p>
</dd>
<dt><a href="#statsDecompression">statsDecompression(baseStatsInput, delta)</a> ⇒ <code>object</code></dt>
<dd><p>Reverse compression of a stats report.</p>
</dd>
<dt><a href="#removeCertificateStats">removeCertificateStats(stats)</a></dt>
<dd><p>Removes certificate stats and references to them.</p>
</dd>
<dt><a href="#removeObsoleteProperties">removeObsoleteProperties(stats)</a></dt>
<dd><p>Removes obsolete properties.</p>
</dd>
<dt><a href="#splitSections">splitSections(sdp)</a> ⇒ <code>Array.&lt;string&gt;</code></dt>
<dd><p>Helper function to split SDP into sections.
Similar to SDPUtils.splitSections but trims.</p>
</dd>
<dt><a href="#descriptionCompression">descriptionCompression(baseDescription, newDescription)</a> ⇒ <code>RTCSessionDescriptionInit</code></dt>
<dd><p>Compresses the new description by splitting the SDP into sections and
replacing sections that are identical with m= (or v= for the first section)
from the base description SDP.</p>
</dd>
<dt><a href="#descriptionDecompression">descriptionDecompression(baseDescription, newDescription)</a> ⇒ <code>string</code> | <code>RTCSessionDescriptionInit</code></dt>
<dd><p>Uncompresses the new description by splitting the SDP into sections and
replacing sections that are equall to m= (or v= for the first section) with
the section from the base description SDP.</p>
</dd>
<dt><a href="#compressMethod">compressMethod(method)</a> ⇒ <code>string</code> | <code>number</code></dt>
<dd><p>Replace a rtcstats method with a numeric identifier.
Unknown methods are returned as-is.</p>
</dd>
<dt><a href="#decompressMethod">decompressMethod(methodKey)</a> ⇒ <code>string</code></dt>
<dd><p>Resolve a compressed method to the original method name.
Unknown method ids are returned as-is.</p>
</dd>
<dt><a href="#compressStatsType">compressStatsType(type)</a> ⇒ <code>string</code> | <code>number</code></dt>
<dd><p>Replace a stats <code>type</code> with a numeric identifier.
Unknown types are returned as-is.</p>
</dd>
<dt><a href="#decompressStatsType">decompressStatsType(type)</a> ⇒ <code>string</code></dt>
<dd><p>Resolve a compressed stats type to the original type.
Unknown types are returned as-is.</p>
</dd>
<dt><a href="#compressStatsProperty">compressStatsProperty(property)</a> ⇒ <code>number</code> | <code>string</code></dt>
<dd><p>Replace a stats property name with a numeric key for known properties.
Unknown property names are returned as-is.</p>
</dd>
<dt><a href="#decompressStatsProperty">decompressStatsProperty(property)</a> ⇒ <code>string</code></dt>
<dd><p>Resolve a numeric stats property key to the original name.
Unknown keys are returned as-is.</p>
</dd>
<dt><a href="#createInternalsTimeSeries">createInternalsTimeSeries()</a></dt>
<dd><p>Creates a timeseries from webrtc-internals.
Returns an object with stats by id and an object of property=&gt; [[ts, value], ...].</p>
</dd>
<dt><a href="#createRtcStatsTimeSeries">createRtcStatsTimeSeries()</a></dt>
<dd><p>Creates a timeseries from rtcstats.
Returns an object with stats by id and an object of property =&gt; [[ts, value], ...].</p>
</dd>
<dt><a href="#map2obj">map2obj(m)</a> ⇒ <code>Object</code></dt>
<dd><p>Transforms a maplike to a JS object. Mostly for getStats + JSON.parse(JSON.stringify())</p>
</dd>
<dt><a href="#dumpTrackWithStreams">dumpTrackWithStreams(track, ...streams)</a> ⇒ <code>Array.&lt;String&gt;</code></dt>
<dd><p>Creates a representation of a track and its associated streams for serialization.</p>
</dd>
<dt><a href="#parseTrackWithStreams">parseTrackWithStreams()</a> ⇒ <code>Object</code></dt>
<dd><p>Parses the serialized track and returns an object (which is not a track).</p>
</dd>
<dt><a href="#copyAndSanitizeConfig">copyAndSanitizeConfig(config)</a> ⇒ <code>Object</code></dt>
<dd><p>Sanitizes a RTCConfiguration by hiding the TURN server credentials and
making the certificates serializable.</p>
</dd>
</dl>

<a name="wrapTrackProperty"></a>

## wrapTrackProperty(track, property, trace)
Wrap the setter for MediaStreamTrack.{property}.
Does not work on the prototype but needs a track instance.
Only done for local tracks where this is most useful.

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| track | <code>MediaStrackTrack</code> | the track whose property (e.g. `enabled`) should be wrapped. |
| property | <code>string</code> | the track whose property (e.g. `enabled`) should be wrapped. |
| trace | <code>function</code> | RTCStats trace callback. |

<a name="wrapGetUserMedia"></a>

## wrapGetUserMedia(trace, window)
Wraps getUserMedia and getDisplayMedia for RTCStats.
Legacy getUserMedia is not wrapped.
Also wraps these methods on MediaStreamTrack
* stop
* applyConstraints
The `ended` event is wrapped as are the setters for `enabled`
and `contentHint`.

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| trace | <code>function</code> | RTCStats trace callback. |
| window | <code>object</code> | window object with navigator and MediaStreamTrack. |

<a name="wrapEnumerateDevices"></a>

## wrapEnumerateDevices(trace, window)
Wraps enumerateDevices and the devicechange event for RTCStats.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| trace | <code>function</code> | RTCStats trace callback. |
| window | <code>object</code> | window object with navigator. |

<a name="wrapRTCRtpTransceiver"></a>

## wrapRTCRtpTransceiver(trace, window)
Wraps a RTCRtpTransceiver for RTCStats. Currently applied to these methods:
* setCodecPreferences
* setHeaderExtensionsToNegotiate

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| trace | <code>function</code> | RTCStats trace callback |
| window | <code>object</code> | window object from which to take the RTCRtpTransceiver protoype. |

<a name="wrapRTCRtpSender"></a>

## wrapRTCRtpSender(trace, window)
Wraps a RTCRtpSenderfor RTCStats. Currently applied to these methods:
* setParameters
* replaceTrack

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| trace | <code>function</code> | RTCStats trace callback |
| window | <code>object</code> | window object from which to take the RTCRtpSender protoype. |

<a name="wrapRTCPeerConnection"></a>

## wrapRTCPeerConnection(trace, window, configuration)
Wraps RTCPeerConnection for RTCStats.
Legacy methods and events are not wrapped.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| trace | <code>function</code> | RTCStats trace callback |
| window | <code>object</code> | window object from which to take the RTCPeerConnection protoype. |
| configuration | <code>object</code> | various configurable properties. Currently: * getStatsInterval {number} - interval at which getStats will be polled. |

<a name="wrapRTCStatsWithDefaultOptions"></a>

## wrapRTCStatsWithDefaultOptions() ⇒ <code>function</code>
Wrap RTCStats WebSocket trace with default options.

**Kind**: global function  
**Returns**: <code>function</code> - RTCStats trace function.  
<a name="statsCompression"></a>

## statsCompression(baseStatsInput, newStatsInput, statsIdMap) ⇒ <code>object</code>
Apply compression to the stats report. Reduces size a lot.

**Kind**: global function  
**Returns**: <code>object</code> - compressed statistics.  

| Param | Type | Description |
| --- | --- | --- |
| baseStatsInput | <code>object</code> \| <code>RTCStatsReport</code> | baseline statistics      against which the delta will be calculated against. |
| newStatsInput | <code>object</code> \| <code>RTCStatsReport</code> | current statistics      from which the delta will be calculated. |
| statsIdMap | <code>object</code> | statsIdMap - initially empty mapping of      full stats id to compressed stats id. Will be modified. |

<a name="statsDecompression"></a>

## statsDecompression(baseStatsInput, delta) ⇒ <code>object</code>
Reverse compression of a stats report.

**Kind**: global function  
**Returns**: <code>object</code> - statistics.  

| Param | Type | Description |
| --- | --- | --- |
| baseStatsInput | <code>object</code> | baseline statistics      from which the statistics will be restored. |
| delta | <code>object</code> | compressed stats delta      from which the delta will be restored. |

<a name="removeCertificateStats"></a>

## removeCertificateStats(stats)
Removes certificate stats and references to them.

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| stats | <code>stats</code> | JSON stats object. |

<a name="removeObsoleteProperties"></a>

## removeObsoleteProperties(stats)
Removes obsolete properties.

**Kind**: global function  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| stats | <code>stats</code> | JSON stats object. |

<a name="splitSections"></a>

## splitSections(sdp) ⇒ <code>Array.&lt;string&gt;</code>
Helper function to split SDP into sections.
Similar to SDPUtils.splitSections but trims.

**Kind**: global function  
**Returns**: <code>Array.&lt;string&gt;</code> - - different sections of the SDP.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| sdp | <code>string</code> | SDP as string. |

<a name="descriptionCompression"></a>

## descriptionCompression(baseDescription, newDescription) ⇒ <code>RTCSessionDescriptionInit</code>
Compresses the new description by splitting the SDP into sections and
replacing sections that are identical with m= (or v= for the first section)
from the base description SDP.

**Kind**: global function  
**Returns**: <code>RTCSessionDescriptionInit</code> - description with compressed SDP.  

| Param | Type | Description |
| --- | --- | --- |
| baseDescription | <code>RTCSessionDescription</code> | old description (potentially null) |
| newDescription | <code>RTCSessionDescription</code> | new description |

<a name="descriptionDecompression"></a>

## descriptionDecompression(baseDescription, newDescription) ⇒ <code>string</code> \| <code>RTCSessionDescriptionInit</code>
Uncompresses the new description by splitting the SDP into sections and
replacing sections that are equall to m= (or v= for the first section) with
the section from the base description SDP.

**Kind**: global function  
**Returns**: <code>string</code> - Uncompressed SDP.<code>RTCSessionDescriptionInit</code> - description with uncompressed SDP.  

| Param | Type | Description |
| --- | --- | --- |
| baseDescription | <code>RTCSessionDescription</code> | old description (potentially null) |
| newDescription | <code>RTCSessionDescription</code> | new description |

<a name="compressMethod"></a>

## compressMethod(method) ⇒ <code>string</code> \| <code>number</code>
Replace a rtcstats method with a numeric identifier.
Unknown methods are returned as-is.

**Kind**: global function  
**Returns**: <code>string</code> \| <code>number</code> - compressed method.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| method | <code>string</code> | rtcstats method. |

<a name="decompressMethod"></a>

## decompressMethod(methodKey) ⇒ <code>string</code>
Resolve a compressed method to the original method name.
Unknown method ids are returned as-is.

**Kind**: global function  
**Returns**: <code>string</code> - rtcstats method.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| methodKey | <code>string</code> \| <code>number</code> | compressed method. |

<a name="compressStatsType"></a>

## compressStatsType(type) ⇒ <code>string</code> \| <code>number</code>
Replace a stats `type` with a numeric identifier.
Unknown types are returned as-is.

**Kind**: global function  
**Returns**: <code>string</code> \| <code>number</code> - compressed stats type.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> | stats type. |

<a name="decompressStatsType"></a>

## decompressStatsType(type) ⇒ <code>string</code>
Resolve a compressed stats type to the original type.
Unknown types are returned as-is.

**Kind**: global function  
**Returns**: <code>string</code> - original stats type.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| type | <code>string</code> \| <code>number</code> | compressed stats type. |

<a name="compressStatsProperty"></a>

## compressStatsProperty(property) ⇒ <code>number</code> \| <code>string</code>
Replace a stats property name with a numeric key for known properties.
Unknown property names are returned as-is.

**Kind**: global function  
**Returns**: <code>number</code> \| <code>string</code> - compressed property key.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| property | <code>string</code> | stats property name to be compressed. |

<a name="decompressStatsProperty"></a>

## decompressStatsProperty(property) ⇒ <code>string</code>
Resolve a numeric stats property key to the original name.
Unknown keys are returned as-is.

**Kind**: global function  
**Returns**: <code>string</code> - property name.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| property | <code>number</code> \| <code>string</code> | stats property name to be decompressed. |

<a name="createInternalsTimeSeries"></a>

## createInternalsTimeSeries()
Creates a timeseries from webrtc-internals.
Returns an object with stats by id and an object of property=> [[ts, value], ...].

**Kind**: global function  
<a name="createRtcStatsTimeSeries"></a>

## createRtcStatsTimeSeries()
Creates a timeseries from rtcstats.
Returns an object with stats by id and an object of property => [[ts, value], ...].

**Kind**: global function  
<a name="map2obj"></a>

## map2obj(m) ⇒ <code>Object</code>
Transforms a maplike to a JS object. Mostly for getStats + JSON.parse(JSON.stringify())

**Kind**: global function  
**Returns**: <code>Object</code> - object with the entries of the map.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| m | <code>Map</code> \| <code>Object</code> | Map or Javascript object. |

<a name="dumpTrackWithStreams"></a>

## dumpTrackWithStreams(track, ...streams) ⇒ <code>Array.&lt;String&gt;</code>
Creates a representation of a track and its associated streams for serialization.

**Kind**: global function  
**Returns**: <code>Array.&lt;String&gt;</code> - - serialized representation.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| track | <code>MediaStreamTrack</code> | the MediaStreamTrack. |
| ...streams | <code>MediaStream</code> | the MediaStreams the track belongs to. |

<a name="parseTrackWithStreams"></a>

## parseTrackWithStreams() ⇒ <code>Object</code>
Parses the serialized track and returns an object (which is not a track).

**Kind**: global function  
**Returns**: <code>Object</code> - - representation of the track with streams.  
<a name="copyAndSanitizeConfig"></a>

## copyAndSanitizeConfig(config) ⇒ <code>Object</code>
Sanitizes a RTCConfiguration by hiding the TURN server credentials and
making the certificates serializable.

**Kind**: global function  
**Returns**: <code>Object</code> - - serializable RTCConfiguration.  
**Access**: protected  

| Param | Type | Description |
| --- | --- | --- |
| config | <code>RTCConfiguration</code> | the RTCConfiguration. |

