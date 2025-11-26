import {compressMethod, dumpTrackWithStreams} from '@rtcstats/rtcstats-shared';

/**
 * Wrap the setter for MediaStreamTrack.{property}.
 * Does not work on the prototype but needs a track instance.
 * Only done for local tracks where this is most useful.
 *
 * @protected
 * @param {MediaStrackTrack} track - the track whose property (e.g. `enabled`) should be wrapped.
 * @param {string} property - the track whose property (e.g. `enabled`) should be wrapped.
 * @param {function} trace - RTCStats trace callback.
 */
function wrapTrackProperty(track, property, trace) {
    const prop = Object.getOwnPropertyDescriptor(
        MediaStreamTrack.prototype, property);

    // Replace the property with a custom one
    Object.defineProperty(track, property, {
        configurable: true,
        enumerable: true,
        get() {
            return prop.get.call(this);
        },
        set(value) {
            trace('MediaStreamTrack.' + property, null, value, this.id);
            prop.set.call(this, value);
        }
    });
}

/**
 * Wraps getUserMedia and getDisplayMedia for RTCStats.
 * Legacy getUserMedia is not wrapped.
 * Also wraps these methods on MediaStreamTrack
 * * stop
 * * applyConstraints
 * The `ended` event is wrapped as are the setters for `enabled`
 * and `contentHint`.
 *
 * @protected
 * @param {function} trace - RTCStats trace callback.
 * @param {object} window - window object with navigator and MediaStreamTrack.
 */
export function wrapGetUserMedia(trace, {navigator, MediaStreamTrack}) {
    const counters = {getUserMedia: 0, getDisplayMedia: 0};
    if (!(navigator && navigator.mediaDevices)) {
        return;
    }
    if (navigator.mediaDevices.__rtcStats) {
        // Prevent double-wrapping.
        return;
    }
    ['getUserMedia', 'getDisplayMedia'].forEach(method => {
        if (!(navigator && 'mediaDevices' in navigator && navigator.mediaDevices[method])) {
            return;
        }
        const origMethod = navigator.mediaDevices[method].bind(navigator.mediaDevices);
        const wrappedMethod = (...args) => {
            const trackingId = compressMethod('navigator.mediaDevices.' + method) +
                '-' + (counters[method]++);
            trace('navigator.mediaDevices.' + method, null, args[0], trackingId);
            return origMethod.apply(navigator.mediaDevices, args)
                .then((stream) => {
                    trace('navigator.mediaDevices.' + method + 'OnSuccess', null,
                        stream.getTracks().map(t => dumpTrackWithStreams(t, stream)),
                        trackingId);
                    stream.getTracks().forEach(track => {
                        track.__rtcStatsId = trackingId;
                        track.addEventListener('ended', () => {
                            trace('MediaStreamTrack.onended', null, track.id, track.__rtcStatsId);
                        });
                        wrapTrackProperty(track, 'enabled', trace);
                        wrapTrackProperty(track, 'contentHint', trace);
                    });
                    return stream;
                }, (err) => {
                    trace('navigator.mediaDevices.' + method + 'OnFailure', null,
                        err.toString(), trackingId);
                    return Promise.reject(err);
                });
        };
        navigator.mediaDevices[method] = wrappedMethod.bind(navigator.mediaDevices);
    });
    if (MediaStreamTrack) {
        ['stop', 'applyConstraints'].forEach(method => {
            const origMethod = MediaStreamTrack.prototype[method];
            MediaStreamTrack.prototype[method] = function(...args) {
                if (this.readyState !== 'ended') {
                    trace('MediaStreamTrack.' + method, null, args, this.id, this.__rtcStatsId);
                }
                return origMethod.apply(this, args);
            };
        });
    }
    navigator.mediaDevices.__rtcStats = true;
}

/**
 * Wraps enumerateDevices and the devicechange event for RTCStats.
 *
 * @param {function} trace - RTCStats trace callback.
 * @param {object} window - window object with navigator.
 */
export function wrapEnumerateDevices(trace, {navigator}) {
    if (!(navigator && 'mediaDevices' in navigator && navigator.mediaDevices.enumerateDevices)) {
        return;
    }
    if (navigator.mediaDevices.enumerateDevices.__rtcStats) {
        // Prevent double-wrapping.
        return;
    }
    const origMethod = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    const wrappedMethod = (...args) => {
        return origMethod.apply(navigator.mediaDevices, args)
            .then((devices) => {
                trace('navigator.mediaDevices.enumerateDevices', null,
                    JSON.parse(JSON.stringify(devices)));
                return devices;
            });
    };
    navigator.mediaDevices.enumerateDevices = wrappedMethod.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices.__rtcStats = true;

    // Listen to devicechange event (which often causes enumerateDevices to be called).
    if ('ondevicechange' in navigator.mediaDevices) {
        navigator.mediaDevices.addEventListener('devicechange', () => {
            trace('navigator.mediaDevices.ondevicechange', null, null);
        });
    }
}

