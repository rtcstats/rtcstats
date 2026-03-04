import {
    statsCompression,
    descriptionCompression,
    compressMethod,
    computePressureTable,
} from '@rtcstats/rtcstats-shared';
import {map2obj, dumpTrackWithStreams, copyAndSanitizeConfig} from '@rtcstats/rtcstats-shared';

/**
 * Wraps a RTCRtpTransceiver for RTCStats. Currently applied to these methods:
 * * setCodecPreferences
 * * setHeaderExtensionsToNegotiate
 *
 * @protected
 * @param {function} trace - RTCStats trace callback
 * @param {object} window - window object from which to take the RTCRtpTransceiver protoype.
 */
function wrapRTCRtpTransceiver(trace, window) {
    if (!window.RTCRtpTransceiver) {
        return;
    }
    ['setCodecPreferences', 'setHeaderExtensionsToNegotiate'].forEach(method => {
        const nativeMethod = window.RTCRtpTransceiver.prototype[method];
        if (!nativeMethod) return;
        window.RTCRtpTransceiver.prototype[method] = function(arg) {
            trace(method, this.__rtcStatsId, arg,
                this.receiver.track.id);
            return nativeMethod.apply(this, [arg]);
        };
    });
}

/**
 * Wraps a RTCRtpSenderfor RTCStats. Currently applied to these methods:
 * * setParameters
 * * replaceTrack 
 *
 * @protected
 * @param {function} trace - RTCStats trace callback
 * @param {object} window - window object from which to take the RTCRtpSender protoype.
 */
function wrapRTCRtpSender(trace, window) {
    if (!window.RTCRtpSender) {
        return;
    }
    ['setParameters'].forEach(method => {
        const nativeMethod = window.RTCRtpSender.prototype[method];
        if (!nativeMethod) return;

        window.RTCRtpSender.prototype[method] = function(parameters, ...args) {
            const serializedArgs = JSON.parse(JSON.stringify([parameters, ...args]));
            delete serializedArgs[0].transactionId;
            trace(method, this.__rtcStatsId,
                serializedArgs,
                this.__rtcStatsSenderId);
            return nativeMethod.apply(this, [parameters, ...args]);
        };
    });
    ['replaceTrack'].forEach(method => {
        const nativeMethod = window.RTCRtpSender.prototype[method];
        if (!nativeMethod) return;
        window.RTCRtpSender.prototype[method] = function(track, ...args) {
            const serializedArgs = [
                this.track === null ? null : dumpTrackWithStreams(this.track),
                track === null ? null : dumpTrackWithStreams(track),
            ];
            trace(method, this.__rtcStatsId,
                serializedArgs,
                this.__rtcStatsSenderId);
            return nativeMethod.apply(this, [track, ...args]);
        };
    });
}

/**
 * Wraps RTCPeerConnection for RTCStats.
 * Legacy methods and events are not wrapped.
 *
 * @param {function} trace - RTCStats trace callback
 * @param {object} window - window object from which to take the RTCPeerConnection protoype.
 * @param {object} configuration - various configurable properties. Currently:
 * * getStatsInterval {number} - interval at which getStats will be polled.
 */
export function wrapRTCPeerConnection(trace, window, {getStatsInterval}) {
    if (!window.RTCPeerConnection) {
        return;
    }
    if (window.RTCPeerConnection.prototype.hasOwnProperty('__rtcStats')) {
        // Prevent double-wrapping.
        return;
    }
    let lastComputePressureRecord;
    if (window.PressureObserver) {
        const observer = new PressureObserver((records) => {
            const lastRecord = records[records.length - 1]; // Usually only one record.
            lastComputePressureRecord = [Date.now(), lastRecord];
        });
        observer.observe('cpu', {sampleInterval: getStatsInterval});
    }
    wrapRTCRtpTransceiver(trace, window);
    wrapRTCRtpSender(trace, window);
    const OrigPeerConnection = window.RTCPeerConnection;
    let peerconnectioncounter = 0;
    // Counters for event correlation.
    const counters = {
        createOffer: 0,
        createAnswer: 0,
        setLocalDescription: 0,
        setRemoteDescription: 0,
        addIceCandidate: 0
    };

    const RTCStatsPeerConnection = function(config, constraints) {
        const pc = new OrigPeerConnection(config, constraints);
        const pcId = 'PC_' + peerconnectioncounter++;
        pc.__rtcStatsId = pcId;

        trace('create', pcId, copyAndSanitizeConfig(config));
        if (constraints) {
            trace('constraints', pcId, constraints);
        }

        pc.addEventListener('icecandidate', (e) => {
            trace('onicecandidate', pcId, e.candidate);
        });
        pc.addEventListener('icecandidateerror', (e) => {
            const serializedArgs = {};
            ['address', 'port', 'hostCandidate',
                'url', 'errorCode', 'errorText'].forEach(key => {
                serializedArgs[key] = e[key];
            });
            trace('onicecandidateerror', pcId, serializedArgs);
        });
        pc.addEventListener('track', (e) => {
            trace('ontrack', pcId, dumpTrackWithStreams(e.track, ...e.streams));
            e.track.addEventListener('unmute', () => {
                trace('MediaStreamTrack.onunmute', pcId, e.track.id);
            });
            e.track.addEventListener('mute', () => {
                trace('MediaStreamTrack.onmute', pcId, e.track.id);
            });
            if (e.transceiver) {
                e.transceiver.__rtcStatsId = pcId;
                e.transceiver.sender.__rtcStatsId = pcId;
                e.transceiver.sender.__rtcStatsSenderId = e.track.id;
            }
            if (e.track.kind === 'video') {
                setTimeout(() => {
                    document.querySelectorAll('video').forEach(el => {
                        if (!el.srcObject) return;
                        if (el.srcObject.getTracks().indexOf(e.track) === -1) return;
                        el.addEventListener('resize', () => {
                            if (el.srcObject.getTracks().indexOf(e.track) === -1) return;
                            trace('HTMLMediaElement.resize', pcId, {
                                width: el.scrollWidth, // displayed size.
                                height: el.scrollHeight,
                                videoWidth: el.videoWidth, // received size.
                                videoHeight: el.videoHeight,
                            }, e.track.id);
                        });
                    });
                }, 0);
            }
        });
        ['signalingState', 'iceConnectionState', 'connectionState',
            'iceGatheringState'].forEach(state => {
            pc.addEventListener(state.toLowerCase() + 'change', () => {
                trace('on' + state.toLowerCase() + 'change', pcId, pc[state]);
            });
        });
        pc.addEventListener('negotiationneeded', () => {
            trace('onnegotiationneeded', pcId, undefined);
        });
        pc.addEventListener('datachannel', (e) => {
            trace('ondatachannel', pcId, [e.channel.id, e.channel.label]);
        });

        let prevStats = {};
        let statsInterval;
        const statsIdMap = {};
        const getStats = async (reason) => {
            if (pc.signalingState === 'closed') {
                if (statsInterval) {
                    window.clearInterval(statsInterval);
                }
                return;
            }
            const stats = map2obj(await pc.getStats());
            if (pc.signalingState === 'closed') {
                return;
            }
            if (lastComputePressureRecord) {
                const [timestamp, record] = lastComputePressureRecord;
                stats['rtcStatsComputePressure'] = {
                    type: 'compute-pressure',
                    timestamp,
                    cpuState: computePressureTable[record.state] || record.state,
                };
            }
            const baseStats = JSON.parse(JSON.stringify(stats)); // our new prevStats.
            const compressedStats = statsCompression(prevStats, stats, statsIdMap);
            if (reason) {
                trace('getStats', pc.__rtcStatsId, compressedStats, reason);
            } else {
                trace('getStats', pc.__rtcStatsId, compressedStats);
            }
            prevStats = baseStats;
        };
        // Listen to the connection establishment and start polling getStats then.
        pc.addEventListener('connectionstatechange', function firstConnect() {
            if (['connected', 'failed'].includes(pc.connectionState)) {
                pc.removeEventListener('connectionstatechange', firstConnect);
                if (getStatsInterval) {
                    statsInterval = window.setInterval(getStats, getStatsInterval);
                }
                getStats(pc.connectionState + '-0');
            }
        });
        return pc;
    };

    ['createDataChannel'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(label, ...args) {
            trace(method, this.__rtcStatsId, [label, ...args]);
            return nativeMethod.apply(this, [label, ...args]);
        };
    });

    ['close', 'restartIce'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function() {
            trace(method, this.__rtcStatsId, undefined);
            return nativeMethod.apply(this, []);
        };
    });

    ['addTrack'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(track, ...args) {
            const streams = args;
            trace(method, this.__rtcStatsId, dumpTrackWithStreams(track, ...streams));
            const sender = nativeMethod.apply(this, [track, ...args]);
            sender.__rtcStatsId = this.__rtcStatsId;
            const transceiver = this.getTransceivers().find(t => t.sender === sender);
            if (transceiver) {
                transceiver.__rtcStatsId = this.__rtcStatsId;
                sender.__rtcStatsSenderId = transceiver.receiver.track.id;
                trace(method + 'OnSuccess', this.__rtcStatsId, null, transceiver.receiver.track.id);
            }
            return sender;
        };
    });

    ['addTransceiver'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(trackOrKind, ...args) {
            const serializedArgs = [
                typeof(trackOrKind) === 'string' ? trackOrKind : dumpTrackWithStreams(trackOrKind),
            ];
            if (args[0]) {
                serializedArgs.push(JSON.parse(JSON.stringify(args[0])));
                if (args[0].streams) {
                    serializedArgs[serializedArgs.length - 1].streams = args[0].streams.map(s => s.id);
                }
            }
            trace(method, this.__rtcStatsId, serializedArgs);
            const transceiver = nativeMethod.apply(this, [trackOrKind, ...args]);
            transceiver.__rtcStatsId =  this.__rtcStatsId;
            transceiver.sender.__rtcStatsId = this.__rtcStatsId;
            transceiver.sender.__rtcStatsSenderId = transceiver.receiver.track.id;
            trace(method + 'OnSuccess', this.__rtcStatsId, null, transceiver.receiver.track.id);
            return transceiver;
        };
    });

    ['removeTrack'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(sender, ...args) {
            trace(method, this.__rtcStatsId, sender.__rtcStatsSenderId);
            return nativeMethod.apply(this, [sender, ...args]);
        };
    });

    ['createOffer', 'createAnswer'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(...args) {
            const trackingId = compressMethod(method) + '-' + (counters[method]++);
            trace(method, this.__rtcStatsId, args[0], trackingId);
            return nativeMethod.apply(this, args)
                .then((description) => {
                    trace(method + 'OnSuccess', this.__rtcStatsId,
                        descriptionCompression(this.localDescription, description),
                        trackingId);
                    if (!this.localDescription) {
                        if (method === 'createOffer') {
                            this.__rtcStatsLastCreatedOffer = description;
                        } else {
                            this.__rtcStatsLastCreatedAnswer = description;
                        }
                    }
                    return description;
                }, (err) => {
                    trace(method + 'OnFailure', this.__rtcStatsId, err.toString(),
                        trackingId);
                    throw err;
                });
        };
    });

    ['setLocalDescription'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(...args) {
            const trackingId = compressMethod(method) + '-' + (counters[method]++);
            let implicitBaseDescription;
            if (args[0]) {
                let explicitBaseDescription;
                if (args[0].type === 'offer') {
                    explicitBaseDescription = this.__rtcStatsLastCreatedOffer;
                } else if (args[0].type === 'answer') {
                    explicitBaseDescription = this.__rtcStatsLastCreatedAnswer;
                }
                delete this.__rtcStatsLastCreatedOffer;
                delete this.__rtcStatsLastCreatedAnswer;
                trace(method, this.__rtcStatsId,
                    descriptionCompression(this.localDescription || explicitBaseDescription, args[0]),
                    trackingId);
            } else {
                // Save previous localDescription for delta.
                implicitBaseDescription = JSON.parse(JSON.stringify(this.localDescription));
                trace(method, this.__rtcStatsId, null, trackingId);
            }

            return nativeMethod.apply(this, args)
                .then(() => {
                    if (args.length === 0) {
                        trace(method + 'OnSuccess', this.__rtcStatsId,
                            descriptionCompression(implicitBaseDescription, this.localDescription),
                            trackingId);
                    } else {
                        trace(method + 'OnSuccess', this.__rtcStatsId, undefined,
                            trackingId);
                    }
                }, (err) => {
                    trace(method + 'OnFailure', this.__rtcStatsId, err.toString(),
                        trackingId);
                    throw err;
                });
        };
    });

    ['setRemoteDescription'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(description, ...args) {
            const trackingId = compressMethod(method) + '-' + (counters[method]++);
            trace(method, this.__rtcStatsId,
                descriptionCompression(this.remoteDescription, description),
                trackingId);

            return nativeMethod.apply(this, [description, ...args])
                .then(() => {
                    trace(method + 'OnSuccess', this.__rtcStatsId, undefined,
                        trackingId);
                }, (err) => {
                    trace(method + 'OnFailure', this.__rtcStatsId, err.toString(),
                        trackingId);
                    throw err;
                });
        };
    });

    ['addIceCandidate'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(...args) {
            const trackingId = compressMethod(method) + '-' + (counters[method]++);
            trace(method, this.__rtcStatsId, args[0], trackingId);
            return nativeMethod.apply(this, args)
                .then((description) => {
                    trace(method + 'OnSuccess', this.__rtcStatsId, undefined,
                        trackingId);
                    return description;
                }, (err) => {
                    trace(method + 'OnFailure', this.__rtcStatsId, err.toString(),
                        trackingId);
                    throw err;
                });
        };
    });

    ['setConfiguration'].forEach(method => {
        const nativeMethod = OrigPeerConnection.prototype[method];
        if (!nativeMethod) return;
        OrigPeerConnection.prototype[method] = function(...args) {
            trace(method, this.__rtcStatsId, copyAndSanitizeConfig(args[0]));
            // TODO: should this catch, log and rethrow? Rare...
            return nativeMethod.apply(this, args);
        };
    });

    // wrap static methods. Currently just generateCertificate.
    if (OrigPeerConnection.generateCertificate) {
        Object.defineProperty(RTCStatsPeerConnection, 'generateCertificate', {
            get(...args) {
                return args.length ?
                    OrigPeerConnection.generateCertificate.apply(null, args)
                    : OrigPeerConnection.generateCertificate;
            },
        });
    }
    window.RTCPeerConnection = RTCStatsPeerConnection;
    window.RTCPeerConnection.prototype = OrigPeerConnection.prototype;
    window.RTCPeerConnection.prototype.__rtcStats = true;
}
