/* eslint sort-keys: "error" */
import SDPUtils from 'sdp';

import {parseTrackWithStreams} from '@rtcstats/rtcstats-shared';

export function extractClientFeatures(clientTrace) {
    // A trace will always have at least one event.
    const create = clientTrace.find(traceEvent => traceEvent.type === 'create').value;
    const getUserMedia = {
        calledGetUserMedia: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called at least once.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia';
        }) !== undefined,
        calledGetUserMediaAudio: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting audio.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && traceEvent.value?.audio !== false;
        }) !== undefined,
        calledGetUserMediaCombined: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting both audio and video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' &&
                traceEvent.value?.audio !== false && traceEvent.value?.video !== false;
        }) !== undefined,
        calledGetUserMediaVideo: clientTrace.find(traceEvent => {
            // Whether getUserMedia was called requesting video.
            return traceEvent.type === 'navigator.mediaDevices.getUserMedia' && traceEvent.value?.video !== false;
        }) !== undefined,
        getUserMediaError: clientTrace.find(traceEvent => {
            // The first getUserMedia error event, if any.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnFailure';
        })?.value,
        getUserMediaErrorCount: clientTrace.filter(traceEvent => {
            // The number of failed getUserMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnFailure';
        }).length,
        getUserMediaSuccessCount: clientTrace.filter(traceEvent => {
            // The number of successful getUserMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getUserMediaOnSuccess';
        }).length,
    };
    const getDisplayMedia = {
        calledGetDisplayMedia: clientTrace.find(traceEvent => {
            // Whether getDisplayMedia was called at least once.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia';
        }) !== undefined,
        calledGetDisplayMediaAudio: clientTrace.find(traceEvent => {
            // Whether getDisplayMedia was called requesting audio.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && traceEvent.value?.audio !== false;
        }) !== undefined,
        calledGetDisplayMediaVideo: clientTrace.find(traceEvent => {
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMedia' && traceEvent.value?.video !== false;
        }) !== undefined,
        getDisplayMediaErrorCount: clientTrace.filter(traceEvent => {
            // The number of failed getDisplayMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMediaOnFailure';
        }).length,
        getDisplayMediaSuccessCount: clientTrace.filter(traceEvent => {
            // The number of successful getDisplayMedia calls.
            return traceEvent.type === 'navigator.mediaDevices.getDisplayMediaOnSuccess';
        }).length,
    };
    const enumerateDevices = {
        enumerateDevicesCount: clientTrace.filter(traceEvent => {
            // How often enumerateDevices was called.
            return traceEvent.type === 'navigator.mediaDevices.enumerateDevices';
        }).length,
    };

    return {
        ...create,
        // The lifetime of the client in milliseconds.
        duration: clientTrace[clientTrace.length - 1].timestamp - clientTrace[0].timestamp,
        ...enumerateDevices,
        ...getDisplayMedia,
        ...getUserMedia,
        // The timestamp at which RTCStatsDump was started.
        startTime: clientTrace[0].timestamp,
    };
}

export function extractConnectionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    // A trace will always have at least one event.
    const ice = {
        iceConnected: peerConnectionTrace.find(traceEvent => {
            // Whether the ice connection was established.
            return traceEvent.type === 'oniceconnectionstatechange' && traceEvent.value === 'connected';
        }) !== undefined,
        iceConnectionTime: (() => {
            // The time it took (in milliseconds) to connect the ICE connection.
            let first;
            let second;
            for (first = 0; first < peerConnectionTrace.length; first++) {
                if (peerConnectionTrace[first].type === 'oniceconnectionstatechange' &&
                    peerConnectionTrace[first].value === 'checking') {
                    break;
                }
            }
            for (second = first + 1; second < peerConnectionTrace.length; second++) {
                if (peerConnectionTrace[second].type === 'oniceconnectionstatechange' &&
                    peerConnectionTrace[second].value === 'connected') {
                    break;
                }
            }
            if (first < peerConnectionTrace.length && second < peerConnectionTrace.length) {
                return peerConnectionTrace[second].timestamp - peerConnectionTrace[first].timestamp;
            }
        })(),
        iceRestart: peerConnectionTrace.find(traceEvent => {
            // Whether a local ICE restart was performed.
            return traceEvent.type === 'createOffer' && traceEvent.value?.iceRestart === true;
        }) !== undefined,
        usingIceLite: peerConnectionTrace.find(traceEvent => {
            // Whether ice-lite was used by the peer (i.e. it is a server).
            if (traceEvent.type !== 'setRemoteDescription') return false;
            return SDPUtils.splitLines(traceEvent.value.sdp).includes('a=ice-lite');
        }) !== undefined,
    };
    const apiFailures = {
        // The error message if addIceCandidate fails.
        addIceCandidateFailure: peerConnectionTrace.find(traceEvent => {
            return traceEvent.type === 'addIceCandidateOnFailure';
        })?.value,
        // The error message if setLocalDescription fails.
        setLocalDescriptionFailure: peerConnectionTrace.find(traceEvent => {
            return traceEvent.type === 'setLocalDescriptionOnFailure';
        })?.value,
        // The error message if setRemoteDescription fails.
        setRemoteDescriptionFailure: peerConnectionTrace.find(traceEvent => {
            return traceEvent.type === 'setRemoteDescriptionOnFailure';
        })?.value,
    };
    const connection = {
        connected: peerConnectionTrace.find(traceEvent => {
            // Whether the connection was established.
            return traceEvent.type === 'onconnectionstatechange' && traceEvent.value === 'connected';
        }) !== undefined,
        connectionTime: (() => {
            // The time it took (in milliseconds) to connect the DTLS connection.
            let first;
            let second;
            for (first = 0; first < peerConnectionTrace.length; first++) {
                if (peerConnectionTrace[first].type === 'onconnectionstatechange' &&
                    peerConnectionTrace[first].value === 'connecting') {
                    break;
                }
            }
            for (second = first + 1; second < peerConnectionTrace.length; second++) {
                if (peerConnectionTrace[second].type === 'onconnectionstatechange' &&
                    peerConnectionTrace[second].value === 'connected') {
                    break;
                }
            }
            if (first < peerConnectionTrace.length && second < peerConnectionTrace.length) {
                return peerConnectionTrace[second].timestamp - peerConnectionTrace[first].timestamp;
            }
        })(),
        dtlsRole: (() => {
            // The DTLS role as defined in https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-dtlsrole
            for (const traceEvent of peerConnectionTrace) {
                if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
                const report = traceEvent.value;
                const transportId = Object.keys(report).find(id => {
                    return report[id].type === 'transport' && ['client', 'server'].includes(report[id].dtlsRole);
                });
                if (transportId) {
                    return report[transportId].dtlsRole;
                }
            }
        })(),
        dtlsVersion: (() => {
            // The DTLS version as defined in https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-tlsversion
            for (const traceEvent of peerConnectionTrace) {
                if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
                const report = traceEvent.value;
                const transportId = Object.keys(report).find(id => {
                    return report[id].type === 'transport' && report[id].dtlsVersion;
                });
                if (transportId) {
                    return report[transportId].dtlsVersion;
                }
            }
        })(),
    };
    const candidates = {
        addedHost: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'addIceCandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'host';
            }
        }) !== undefined,
        addedMdns: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'addIceCandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'host' && candidate.address.endsWith('.local');
            }
        }) !== undefined,
        addedSrflx: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'addIceCandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'srflx';
            }
        }) !== undefined,
        addedTurn: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'addIceCandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'relay';
            }
        }) !== undefined,
        gatheredHost: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'onicecandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'host';
            }
        }) !== undefined,
        gatheredMdns: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'onicecandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'host' && candidate.address.endsWith('.local');
            }
        }) !== undefined,
        gatheredSrflx: peerConnectionTrace.find(traceEvent => {
            if (traceEvent.type === 'onicecandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'srflx';
            }
        }) !== undefined,
        gatheredTurn: peerConnectionTrace.find(traceEvent => {
            // TODO: Determining the TURN relayProtocol is tricky. We could restore the old
            // priority->type table but that is incorrect in Firefox since they use
            // 0 for both TURN/TCP and TURN/TLS. We could send `relayProtocol` from
            // JS, possibly along with the URL. But that is also not available in
            // Firefox... still. For now it is probably best to only determine that a relay
            // candidate was found and then look at the first candidate stats relayProtocol.
            if (traceEvent.type === 'onicecandidate' && traceEvent.value?.candidate) {
                const candidate = SDPUtils.parseCandidate(traceEvent.value.candidate);
                return candidate.type === 'relay';
            }
        }) !== undefined,
    };
    const firstCandidatePair = (() => {
        // Information about the first candidate pair after the connection is connected.
        // Search for first getStats after connectionstate->connected.
        let i;
        for (i = 0; i < peerConnectionTrace.length; i++) {
            if (peerConnectionTrace[i].type === 'onconnectionstatechange' &&
                peerConnectionTrace[i].value === 'connected') {
                break;
            }
        }
        for (; i < peerConnectionTrace.length; i++) {
            if (peerConnectionTrace[i].type !== 'getStats') continue;
            const report = peerConnectionTrace[i].value;
            let pair = null;
            Object.keys(report).forEach(id => {
                const stats = report[id];
                // Spec.
                if (stats.type === 'transport' && stats.selectedCandidatePairId) {
                    const candidatePair = report[stats.selectedCandidatePairId];
                    const localCandidate = report[candidatePair.localCandidateId];
                    const remoteCandidate = report[candidatePair.remoteCandidateId];
                    pair = {
                        firstCandidatePairLocalAddress: localCandidate.address,
                        firstCandidatePairLocalNetworkType: localCandidate.networkType,
                        firstCandidatePairLocalProtocol: localCandidate.protocol,
                        firstCandidatePairLocalRelayProtocol: localCandidate.relayProtocol,
                        firstCandidatePairLocalRelayUrl: localCandidate.url,
                        firstCandidatePairLocalType: localCandidate.candidateType,
                        firstCandidatePairLocalTypePreference: localCandidate.priority >> 24,
                        firstCandidatePairRemoteAddress: remoteCandidate.address,
                        firstCandidatePairRemoteType: remoteCandidate.candidateType,
                    };
                }
                /*
                // Firefox... still!
                if (report.type === 'candidate-pair' && report.selected === true) {
                    const localCandidate = statsReport[report.localCandidateId];
                    const remoteCandidate = statsReport[report.remoteCandidateId];
                    pair = {
                        firstCandidatePairLocalAddress: localCandidate.address,
                        firstCandidatePairLocalNetworkType: '',
                        firstCandidatePairLocalProtocol: localCandidate.protocol,
                        firstCandidatePairLocalRelayProtocol: localCandidate.relayProtocol,
                        firstCandidatePairLocalRelayUrl: localCandidate.url,
                        firstCandidatePairLocalType: localCandidate.candidateType,
                        firstCandidatePairLocalTypePreference: localCandidate.priority >> 24,
                        firstCandidatePairRemoteAddress: remoteCandidate.address,
                        firstCandidatePairRemoteType: remoteCandidate.candidateType,
                    };
                }
                */
            });
            if (pair) {
                return pair;
            }
        }
    })();
    return {
        ... apiFailures,
        ... connection,
        // Whether the peer connection was closed using `pc.close()`.
        closed: peerConnectionTrace[peerConnectionTrace.length - 1].type === 'close',
        // The lifetime of the peer connection in milliseconds.
        duration: peerConnectionTrace[peerConnectionTrace.length - 1].timestamp - peerConnectionTrace[0].timestamp,
        ...ice,
        ...candidates,
        ...firstCandidatePair,
        // The total number of events in the peer connection trace.
        numberOfEvents: peerConnectionTrace.length,
        // The number of events in the peer connection trace excluding periodic 'getStats'.
        numberOfEventsNotGetStats: peerConnectionTrace.filter(traceEvent => traceEvent.type !== 'getStats').length,
        // The timestamp at which the peer connection was created.
        startTime: peerConnectionTrace[0].timestamp,
    };
}

export function extractTrackFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
    // Track stats can be extracted by iterating over peerConnectionTrace and looking at
    // getStats events which are associated with trackInformation.statsId.
    const codec = (() => {
        for (const traceEvent of peerConnectionTrace) {
            if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
            const report = traceEvent.value;
            if (!report[trackInformation.statsId]) continue;
            const codecId = report[trackInformation.statsId].codecId;
            if (!(codecId && report[codecId])) continue;
            const codec = report[codecId];
            return {
                codecMimeType: codec.mimeType,
                codecSdpFmtpLine: codec.sdpFmtpLine || '',
            };
        }
    })();

    const features = {
        ...codec,
        direction: trackInformation.direction,
        duration: 0,
        kind: trackInformation.kind,
        startTime: trackInformation.startTime,
        trackId: trackInformation.id,
    };
    // Find the last stats.
    for (let i = peerConnectionTrace.length - 1; i >= 0; i--) {
        const traceEvent = peerConnectionTrace[i];
        if (traceEvent.type !== 'getStats') continue;
        features['duration'] = Math.floor(traceEvent.timestamp - trackInformation.startTime);
        break;
    }
    return {
        ...features,
    };
}
