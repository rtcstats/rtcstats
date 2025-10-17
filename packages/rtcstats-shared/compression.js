import {map2obj} from './utils.js';

/**
 * Apply compression to the stats report. Reduces size a lot.
 * @param {object|RTCStatsReport} baseStatsInput - baseline statistics
 *      against which the delta will be calculated against.
 * @param {object|RTCStatsReport} newStatsInput - current statistics
 *      from which the delta will be calculated.
 * @param {object} statsIdMap statsIdMap - initially empty mapping of
 *      full stats id to compressed stats id. Will be modified.
 *
 * @returns {object} compressed statistics.
 */
export function statsCompression(baseStatsInput, newStatsInput, statsIdMap) {
    const baseStats = map2obj(baseStatsInput);
    const delta = JSON.parse(JSON.stringify(map2obj(newStatsInput)));

    const removedObjectIds = [];
    // Detect any removed values that were ever transmitted.
    // Those get flagged at the end.
    Object.keys(baseStats).forEach((id) => {
        if (statsIdMap[id] !== undefined && delta[id] === undefined) {
            removedObjectIds.push(id);
        }
    });

    // Core delta compression.
    Object.keys(delta).forEach((id) => {
        const report = delta[id];
        delete report.id;
        if (!baseStats[id]) {
            return;
        }
        Object.keys(report).forEach((name) => {
            if (report[name] === baseStats[id][name]) {
                delete delta[id][name];
            } else if (Array.isArray(report[name])) {
                // Arrays get serialized if anything changed.
                if (JSON.stringify(report[name]) === JSON.stringify(baseStats[id][name])) {
                    delete delta[id][name];
                }
            } else if (typeof(report[name]) === 'object') {
                Object.keys(report[name]).forEach(key => {
                    if (baseStats[id][name] && baseStats[id][name][key] === report[name][key]) {
                        delete delta[id][name][key];
                    }
                });
                if (Object.keys(report[name]).length === 0) {
                    delete report[name];
                }
            }
            // TODO: does this ever happen since we have `timestamp`?
            if (Object.keys(report).length === 0) {
                delete delta[id];
            }
        });
    });

    // Collapse timestamps to latest timestamp (if equal)
    // and move to top-level.
    // TODO: can we make this relative to load time?
    let timestamp = -Infinity;
    Object.keys(delta).forEach((id) => {
        const report = delta[id];
        if (report.timestamp > timestamp) {
            timestamp = report.timestamp;
        }
    });
    Object.keys(delta).forEach((id) => {
        const report = delta[id];
        if (report.timestamp === timestamp) {
            delete report.timestamp;
            if (Object.keys(report).length === 0) {
                delete delta[id];
            }
        }
    });
    if (timestamp !== -Infinity) {
        delta[compressStatsProperty('timestamp')] = timestamp;
    }

    // Remove mostly useless things like certificate stats.
    removeCertificateStats(delta);
    removeObsoleteProperties(delta);

    // Replace the semi-structured ids with numerically increasing ones.
    // Also replace the references so this operation does not need to be
    // reversed on the other end.
    Object.keys(delta).forEach((id) => {
        if (!statsIdMap.hasOwnProperty(id) && typeof delta[id] === 'object') {
            statsIdMap[id] = (Object.keys(statsIdMap).length).toString();
        }
    });
    Object.keys(delta).forEach((id) => {
        if (typeof delta[id] !== 'object') return;
        const newId = statsIdMap[id];
        if (id === newId) return;
        delta[newId] = delta[id];
        Object.keys(delta[id]).forEach(property => {
            if (property.endsWith('Id')) {
                delta[newId][property] = statsIdMap[delta[id][property]];
            }
        });
        delete delta[id];
    });

    // Compress property names using a static table.
    // Done last so other parts of the algorithm do not have to deal with
    // the internal property names.
    Object.keys(delta).forEach((id) => {
        const report = delta[id];
        Object.keys(report).forEach((name) => {
            const newName = compressStatsProperty(name);
            if (newName === name) {
                if (name === 'type') {
                    // Compressing `type` is useful for the first time, after
                    // that the effect is gone due to delta compression.
                    report[name] = compressStatsType(report[name]);
                }
                return;
            }
            report[newName] = report[name];
            delete report[name];
        });
    });

    // Set removed object ids to null. Don't remove them from the idMap so the
    // key stays unique.
    removedObjectIds.forEach((id) => {
        delta[statsIdMap[id] || id] = null;
    });

    // TODO: consider truncating floating point numbers to three decimals.
    return delta;
}

/**
 * Reverse compression of a stats report.
 * @param {object} baseStatsInput - baseline statistics
 *      from which the statistics will be restored.
 * @param {object} delta - compressed stats delta
 *      from which the delta will be restored.
 *
 * @returns {object} statistics.
 */
export function statsDecompression(baseStatsInput, delta) {
    const baseStats = map2obj(baseStatsInput);
    const newStats = JSON.parse(JSON.stringify(map2obj(delta)));

    // Decompress property names using a static table.
    Object.keys(newStats).forEach((id) => {
        const report = newStats[id];
        if (report === null) {
            return;
        }
        Object.keys(report).forEach((name) => {
            const newName = decompressStatsProperty(name);
            if (newName === name) {
                if (name === 'type') {
                    report[name] = decompressStatsType(report[name]);
                }
                return;
            }
            report[newName] = report[name];
            delete report[name];
        });
    });
    const timestamp = newStats[compressStatsProperty('timestamp')];
    delete newStats[compressStatsProperty('timestamp')];

    // Core delta decompression.
    Object.keys(baseStats).forEach(id => {
        if (newStats[id] === null) {
            // This id was removed and is no longer valid.
            delete newStats[id];
            return;
        }
        if (!newStats[id]) {
            newStats[id] = baseStats[id];
        } else {
            const report = baseStats[id];
            Object.keys(report).forEach(name => {
                if (!newStats[id][name]) {
                    newStats[id][name] = report[name];
                } else if (typeof(report[name]) === 'object') {
                    const newObject = newStats[id][name];
                    newStats[id][name] = report[name];
                    Object.keys(newObject).forEach(key => {
                        newStats[id][name][key] = newObject[key];
                    });
                } // Else: take the new value.
            });
        }
        if (timestamp !== undefined) {
            newStats[id].timestamp = timestamp;
        }
    });

    // Uncollapse timestamps from top-level
    if (timestamp !== undefined) {
        Object.keys(newStats).forEach((id) => {
            const report = newStats[id];
            if (!report) return;
            if (report.timestamp === undefined) {
                report.timestamp = timestamp;
            }
        });
    }

    return newStats;
}

/**
 * Removes certificate stats and references to them.
 * @protected
 * @param stats {stats} - JSON stats object.
 */
function removeCertificateStats(stats) {
    Object.keys(stats).forEach((id) => {
        const report = stats[id];
        if (report.type === 'certificate') {
            delete stats[id];
        }
        if (report.type === 'transport') {
            delete report.localCertificateId;
            delete report.remoteCertificateId;
        }
    });
}

/**
 * Removes obsolete properties.
 * @protected
 * @param stats {stats} - JSON stats object.
 */
function removeObsoleteProperties(stats) {
    Object.keys(stats).forEach((id) => {
        const report = stats[id];
        ['isRemote', 'ip', 'mediaType', 'writable'].forEach(property => {
            delete report[property];
        });
    });
}

/**
 * Helper function to split SDP into sections.
 * Similar to SDPUtils.splitSections but trims.
 * @protected
 * @param {string} sdp - SDP as string.
 *
 * @returns {string[]} - different sections of the SDP.
 */
// Similar to SDPUtils.splitSections but trims.
function splitSections(sdp) {
    return sdp.split('\nm=')
        .map((part, index) => (index > 0 ?
            'm=' + part : part).trim());
}

/**
 * Compresses the new description by splitting the SDP into sections and
 * replacing sections that are identical with m= (or v= for the first section)
 * from the base description SDP.
 *
 * @param {RTCSessionDescription} baseDescription - old description (potentially null)
 * @param {RTCSessionDescription} newDescription - new description
 *
 * @returns {RTCSessionDescriptionInit} description with compressed SDP.
 */
export function descriptionCompression(baseDescription, newDescription) {
    if (!baseDescription || baseDescription.type !== newDescription.type ||
            !newDescription.sdp || !baseDescription.sdp) {
        return newDescription;
    }
    const baseSections = splitSections(baseDescription.sdp);
    const newSections = splitSections(newDescription.sdp);
    const sdp = newSections.map((newSection, index) => {
        return (newSection === baseSections[index] ?
            (index === 0 ? 'v=' : 'm=') : newSection);
    }).join('\r\n') + '\r\n';
    return {
        type: newDescription.type,
        sdp,
    };
}

/**
 * Uncompresses the new description by splitting the SDP into sections and
 * replacing sections that are equall to m= (or v= for the first section) with
 * the section from the base description SDP.
 *
 * @returns {string} Uncompressed SDP.
 * @param {RTCSessionDescription} baseDescription - old description (potentially null)
 * @param {RTCSessionDescription} newDescription - new description
 *
 * @returns {RTCSessionDescriptionInit} description with uncompressed SDP.
 */
export function descriptionDecompression(baseDescription, newDescription) {
    if (!baseDescription || baseDescription.type !== newDescription.type ||
            !newDescription.sdp || !baseDescription.sdp) {
        return newDescription;
    }
    const baseSections = splitSections(baseDescription.sdp);
    const newSections = splitSections(newDescription.sdp);
    const sdp = newSections.map((newSection, index) => {
        return (newSection === (index === 0 ? 'v=' : 'm=') ? baseSections[index] : newSection);
    }).join('\r\n').trim() + '\r\n';
    return {
        type: newDescription.type,
        sdp,
    };
}

// Table-based lookup for compression of methods.
// Numbers must not be reassigned.
const methodTable = {
    // Main peerconnection APIs.
    // These are very common so ordered specifically such that
    // they get ѕingle-digit ids.
    getStats: 'g',
    createOffer: 2,
    createOfferOnSuccess: 3,
    createOfferOnFailure: 12,
    createAnswer: 4,
    createAnswerOnSuccess: 5,
    createAnswerOnFailure: 13,
    setLocalDescription: 6,
    setLocalDescriptionOnSuccess: 7,
    setLocalDescriptionOnFailure: 14,
    setRemoteDescription: 8,
    setRemoteDescriptionOnSuccess: 9,
    setRemoteDescriptionOnFailure: 15,
    addIceCandidate: 10,
    addIceCandidateOnSuccess: 11,
    addIceCandidateOnFailure: 16,
    // peerconnection events.
    onicecandidate: 20,
    onicecandidateerror: 21,
    ontrack: 22,
    onsignalingstatechange: 23,
    oniceconnectionstatechange: 24,
    onconnectionstatechange: 25,
    onicegatheringstatechange: 26,
    onnegotiationneeded: 27,
    ondatachannel: 28,
    // Media APIs.
    addTrack: 30,
    addTrackOnSuccess: 31,
    addTransceiver: 32,
    addTransceiverOnSuccess: 33,
    removeTrack: 34,
    // Misc APIs.
    createDataChannel: 35, 
    close: 36,
    restartIce: 37,
    setConfiguration: 38,
    // Constructor (and constraints)
    create: 39,
    constraints: 40,
    // Transceiver APIs.
    setCodecPreferences: 41,
    setHeaderExtensionsToNegotiate: 42,
    // Sender APIs.
    setParameters: 50,
    replaceTrack: 51,
    // getUserMedia and friends.
    'navigator.mediaDevices.getUserMedia': 60,
    'navigator.mediaDevices.getUserMediaOnSuccess': 61,
    'navigator.mediaDevices.getUserMediaOnFailure': 62,
    'navigator.mediaDevices.getDisplayMedia': 63,
    'navigator.mediaDevices.getDisplayMediaOnSuccess': 64,
    'navigator.mediaDevices.getUserMediaOnFailure': 65,
    'navigator.mediaDevices.enumerateDevices': 66,
    'navigator.mediaDevices.ondevicechange': 67,
    // MediaStreamTrack methods and events.
    'MediaStreamTrack.stop':  70,
    'MediaStreamTrack.applyConstraints':  71,
    'MediaStreamTrack.onended': 72,
    'MediaStreamTrack.onmute': 73,
    'MediaStreamTrack.onunmute': 74,
};
const reverseMethodTable = Object.keys(methodTable).reduce((table, method) => {
    table[methodTable[method]] = method;
    return table;
}, {});

/**
 * Replace a rtcstats method with a numeric identifier.
 * Unknown methods are returned as-is.
 * @protected
 * @param {string} method - rtcstats method.
 *
 * @returns {string|number} compressed method.
 */
export function compressMethod(method) {
    return methodTable[method] || method;
}

/**
 * Resolve a compressed method to the original method name.
 * Unknown method ids are returned as-is.
 * @protected
 * @param {string|number} methodKey - compressed method.
 *
 * @returns {string} rtcstats method.
 */
export function decompressMethod(methodKey) {
    return reverseMethodTable[methodKey] || methodKey;
}

// Table-based lookup for compression of stats types.
// Numbers must not be reassigned.
// https://w3c.github.io/webrtc-stats/#rtcstatstype-str*
const statsTypeTable = {
    'inbound-rtp': 1,
    'outbound-rtp': 2,
    'remote-inbound-rtp': 3,
    'remote-outbound-rtp': 4,
    'transport': 5,
    'candidate-pair': 6,
    'local-candidate': 7,
    'remote-candidate': 8,
    'data-channel': 9,
    'peer-connection': 10,
    'certificate': 11,
    'media-source': 12,
    'media-playout': 13,
    'codec': 14,
};
const reverseStatsTypeTable = Object.keys(statsTypeTable).reduce((table, type) => {
    table[statsTypeTable[type]] = type;
    return table;
}, {});

/**
 * Replace a stats `type` with a numeric identifier.
 * Unknown types are returned as-is.
 * @protected
 * @param {string} type - stats type.
 *
 * @returns {string|number} compressed stats type.
 */
export function compressStatsType(type) {
    return statsTypeTable[type] || type;
}

/**
 * Resolve a compressed stats type to the original type.
 * Unknown types are returned as-is.
 * @protected
 * @param type {string|number} - compressed stats type.
 *
 * @returns {string} original stats type.
 */
export function decompressStatsType(typeKey) {
    return reverseStatsTypeTable[typeKey] || typeKey;
}

// Table-based lookup for compression of stats properties.
// Numbers must not be reassigned.
// https://w3c.github.io/webrtc-pc/#mandatory-to-implement-stats
// https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/modules/peerconnection/rtc_stats_report.idl
// is the most complete reference.
// TODO: sort these to minimize symbol length for most-used.
const statsPropertyTable = {
    // https://w3c.github.io/webrtc-pc/#rtcstats-dictionary
    timestamp: 't',
    // type: 2,
    // id: 3,
    // https://www.w3.org/TR/webrtc-stats/#codec-dict*
    payloadType: 4,
    transportId: 5,
    mimeType: 6,
    clockRate: 7,
    channels: 8,
    sdpFmtpLine: 9,
    // https://w3c.github.io/webrtc-stats/#streamstats-dict*
    ssrc: 10,
    kind: 11,
    // transportId duplicate from 4
    codecId: 12,
    // Non-standard and obsolete stats.
    // mediaType: 13,
    // https://w3c.github.io/webrtc-stats/#receivedrtpstats-dict*
    packetsReceived: 14,
    packetsLost: 15,
    jitter: 16,
    // https://w3c.github.io/webrtc-stats/#inboundrtpstats-dict*
    trackIdentifier: 17,
    mid: 18,
    remoteId: 19,
    framesDecoded: 20,
    keyFramesDecoded: 21,
    // Not implemented: unsigned long        framesRendered;
    framesDropped: 22,
    frameWidth: 23,
    frameHeight: 24,
    framesPerSecond: 25,
    qpSum: 26,
    totalDecodeTime: 27,
    totalInterFrameDelay: 28,
    totalSquaredInterFrameDelay: 29,
    pauseCount: 30,
    totalPausesDuration: 31,
    freezeCount: 32,
    totalFreezesDuration: 33,
    lastPacketReceivedTimestamp: 34,
    headerBytesReceived: 35,
    packetsDiscarded: 36,
    fecPacketsReceived: 37,
    fecPacketsDiscarded: 38,
    fecBytesReceived: 39,
    fecSsrc: 40,
    bytesReceived: 41,
    nackCount: 42,
    firCount: 43,
    pliCount: 44,
    totalProcessingDelay: 45,
    estimatedPlayoutTimestamp: 46,
    jitterBufferDelay: 47,
    jitterBufferTargetDelay: 48,
    jitterBufferEmittedCount: 49,
    jitterBufferMinimumDelay: 50,
    totalSamplesReceived: 51,
    concealedSamples: 52,
    silentConcealedSamples: 53,
    concealmentEvents: 54,
    insertedSamplesForDeceleration: 55,
    removedSamplesForAcceleration: 56,
    audioLevel: 57,
    totalAudioEnergy: 58,
    totalSamplesDuration: 59,
    framesReceived: 60,
    decoderImplementation: 61,
    playoutId: 62,
    powerEfficientDecoder: 63,
    framesAssembledFromMultiplePackets: 64,
    totalAssemblyTime: 65,
    // https://w3c.github.io/webrtc-provisional-stats/#RTCInboundRtpStreamStats-dict*
    contentType: 66,
    // https://github.com/w3c/webrtc-provisional-stats/issues/40
    googTimingFrameInfo: 67,
    retransmittedPacketsReceived: 68,
    retransmittedBytesReceived: 69,
    rtxSsrc: 70,
    totalCorruptionProbability: 71,
    totalSquaredCorruptionProbability: 72,
    corruptionMeasurements: 73,
    // https://w3c.github.io/webrtc-stats/#remoteinboundrtpstats-dict*
    localId: 74,
    roundTripTime: 75,
    totalRoundTripTime: 76,
    fractionLost: 77,
    roundTripTimeMeasurements: 78,
    // https://w3c.github.io/webrtc-stats/#sentrtpstats-dict*
    packetsSent: 79,
    bytesSent: 80,
    // https://w3c.github.io/webrtc-stats/#outboundrtpstats-dict*
    // mid duplicate from 17
    mediaSourceId: 81,
    // remoteId duplicate from 18
    rid: 82,
    encodingIndex: 83,
    headerBytesSent: 84,
    retransmittedPacketsSent: 85,
    retransmittedBytesSent: 86,
    // rtxSsrc duplicate from 69
    targetBitrate: 87,
    totalEncodedBytesTarget: 88,
    // frameWidth duplicate from 22
    // frameHeight duplicate from 23
    // framesPerSecond duplicate from 24
    framesSent: 89,
    hugeFramesSent: 90,
    framesEncoded: 91,
    keyFramesEncoded: 92,
    // qpSum duplicate from 25
    totalEncodeTime: 93,
    totalPacketSendDelay: 94,
    qualityLimitationReason: 95,
    qualityLimitationDurations: 96,
    qualityLimitationResolutionChanges: 97,
    // nackCount duplicate from 41
    // firCount duplicate from 42
    // pliCount duplicate from 43
    encoderImplementation: 98,
    powerEfficientEncoder: 99,
    active: 100,
    scalabilityMode: 101,
    // contentType duplicate from 65
    // https://w3c.github.io/webrtc-stats/#remoteoutboundrtpstats-dict*
    // localId duplicate from 73
    remoteTimestamp: 102,
    reportsSent: 103,
    // roundTripTime duplicate from 74
    // totalRoundTripTime duplicate from 75
    // roundTripTimeMeasurements duplicate from 77
    // https://w3c.github.io/webrtc-stats/#mediasourcestats-dict*
    // trackIdentifier duplicate from 16
    // kind duplicate from 10
    // https://w3c.github.io/webrtc-stats/#audiosourcestats-dict*
    // audioLevel duplicate from 56
    // totalAudioEnergy duplicate from 57
    // totalSamplesDuration duplicate from 58
    echoReturnLoss: 104,
    echoReturnLossEnhancement: 105,
    // Not implemented: double              droppedSamplesDuration;
    // Not implemented: unsigned long       droppedSamplesEvents;
    // Not implemented: double              totalCaptureDelay;
    // Not implemented: unsigned long long  totalSamplesCaptured;
    // https://w3c.github.io/webrtc-stats/#videosourcestats-dict*
    width: 106,
    height: 107,
    frames: 108,
    // framesPerSecond duplicate from 24
    // https://w3c.github.io/webrtc-stats/#playoutstats-dict*
    // kind duplicate from 10
    synthesizedSamplesDuration: 109,
    synthesizedSamplesEvents: 110,
    // totalSamplesDuration duplicate from 58
    totalPlayoutDelay: 111,
    totalSamplesCount: 112,
    // https://w3c.github.io/webrtc-stats/#pcstats-dict*
    dataChannelsOpened: 113,
    dataChannelsClosed: 114,
    // https://w3c.github.io/webrtc-stats/#dcstats-dict*
    label: 115,
    protocol: 116,
    dataChannelIdentifier: 117,
    state: 118,
    messagesSent: 119,
    // bytesSent duplicate from 79
    messagesReceived: 120,
    // bytesReceived duplicate from 40
    // https://w3c.github.io/webrtc-stats/#transportstats-dict*
    // packetsSent duplicate from 78
    // packetsReceived duplicate from 13
    // bytesSent duplicate from 79
    // bytesReceived duplicate from 40
    iceRole: 121,
    iceLocalUsernameFragment: 122,
    dtlsState: 123,
    iceState: 124,
    selectedCandidatePairId: 125,
    localCertificateId: 126,
    remoteCertificateId: 127,
    tlsVersion: 128,
    dtlsCipher: 129,
    dtlsRole: 130,
    srtpCipher: 131,
    selectedCandidatePairChanges: 132,
    // https://w3c.github.io/webrtc-provisional-stats/#RTCTransportStats-dict*
    rtcpTransportStatsId: 133,
    // https://w3c.github.io/webrtc-stats/#icecandidate-dict*
    // transportId duplicate from 4
    address: 134,
    port: 135,
    // protocol duplicate from 115
    candidateType: 136,
    priority: 137,
    url: 138,
    relayProtocol: 139,
    foundation: 140,
    relatedAddress: 141,
    relatedPort: 142,
    usernameFragment: 143,
    tcpType: 144,
    // https://w3c.github.io/webrtc-provisional-stats/#RTCIceCandidateStats-stat*
    networkType: 145,
    // Non-standard and obsolete stats.
    // - Removed because `type` reveals same information ('local-candidate' or
    //   'remote-candidate').
    // isRemote: 146,
    // - Removed because it was renamed `address`.
    // ip: 147,
    // https://w3c.github.io/webrtc-stats/#candidatepair-dict*
    // transportId duplicate from 4
    localCandidateId: 148,
    remoteCandidateId: 149,
    // state duplicate from 117
    nominated: 150,
    // packetsSent duplicate from 78
    // packetsReceived duplicate from 13
    // bytesSent duplicate from 79
    // bytesReceived duplicate from 40
    lastPacketSentTimestamp: 151,
    // lastPacketReceivedTimestamp duplicate from 33
    // totalRoundTripTime duplicate from 75
    currentRoundTripTime: 152,
    availableOutgoingBitrate: 153,
    availableIncomingBitrate: 154,
    requestsReceived: 155,
    requestsSent: 156,
    responsesReceived: 157,
    responsesSent: 158,
    consentRequestsSent: 159,
    packetsDiscardedOnSend: 160,
    bytesDiscardedOnSend: 161,
    // Non-standard and obsolete stats.
    // writable: 162,
    // priority duplicate from 136
    // https://w3c.github.io/webrtc-stats/#certificatestats-dict*
    fingerprint: 163,
    fingerprintAlgorithm: 164,
    base64Certificate: 165,
    issuerCertificateId: 166,
};
const reverseStatsPropertyTable = Object.keys(statsPropertyTable).reduce((table, property) => {
    table[statsPropertyTable[property]] = property;
    return table;
}, {});

/**
 * Replace a stats property name with a numeric key for known properties.
 * Unknown property names are returned as-is.
 * @protected
 * @param property {string} - stats property name to be compressed.
 *
 * @returns {number|string} compressed property key.
 */
export function compressStatsProperty(property) {
    return statsPropertyTable[property] || property;
}

/**
 * Resolve a numeric stats property key to the original name.
 * Unknown keys are returned as-is.
 * @protected
 * @param property {number|string} - stats property name to be decompressed.
 *
 * @returns {string} property name.
 */
export function decompressStatsProperty(property) {
    return reverseStatsPropertyTable[property] || property;
}

