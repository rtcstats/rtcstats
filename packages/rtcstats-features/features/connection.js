/* eslint sort-keys: "error" */
import SDPUtils from 'sdp';

function pluckStat(statsObject, properties) {
    if (!statsObject) return;
    for (const property of properties) {
        if (statsObject.hasOwnProperty(property)) {
            return statsObject[property];
        }
    }
}

function getSelectedCandidatePairStats(report) {
    const selectedCandidatePairId = Object.keys(report).find(id => {
        const stats = report[id];
        // Spec.
        return stats.type === 'transport' && stats.selectedCandidatePairId;
        /*
        // Firefox... still!
        return report.type === 'candidate-pair' && report.selected === true;
        */
    });
    if (selectedCandidatePairId) {
        return report[selectedCandidatePairId];
    }
    return undefined;
}

function iceFeatures(/* clientTrace */_, peerConnectionTrace) {
    return {
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
        iceRestartFollowedBySetRemoteDescription: (() => {
            let i;
            // Search for createOffer with iceRestart set to true.
            for (i = 0; i < peerConnectionTrace.length; ++i) {
                if (peerConnectionTrace[i].type === 'createOffer' &&
                    peerConnectionTrace[i].value?.iceRestart === true) {
                    break;
                }
            }
            // Search for setLocalDescription with type=offer.
            for (; i < peerConnectionTrace.length; i++) {
                if (peerConnectionTrace[i].type === 'setLocalDescription' && peerConnectionTrace[i].value?.type === 'offer') {
                    break;
                }
            }
            // Search for setRemoteDescription with type=answer.
            for (; i < peerConnectionTrace.length; i++) {
                if (peerConnectionTrace[i].type === 'setRemoteDescription' && peerConnectionTrace[i].value?.type === 'answer') {
                    return true;
                }
            }
            return false;
        })(),
        usingIceLite: peerConnectionTrace.find(traceEvent => {
            // Whether ice-lite was used by the peer (i.e. it is a server).
            if (traceEvent.type !== 'setRemoteDescription') return false;
            return SDPUtils.splitLines(traceEvent.value.sdp).includes('a=ice-lite');
        }) !== undefined,
    };
}

function apiFailures(/* clientTrace*/_, peerConnectionTrace) {
    return {
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
}

function connectionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    const dtls = (() => {
        // The DTLS version and role as defined in
        //   https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-tlsversion
        //   https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-dtlsrole
        // Also srtpCipher which is derived from DTLS and defined in
        //   https://w3c.github.io/webrtc-stats/#dom-rtctransportstats-srtpcipher
        // Note: the role is set after O/A, version and srtpCipher requires the handshake
        // to be complete.
        for (const traceEvent of peerConnectionTrace) {
            if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
            const report = traceEvent.value;
            const transportId = Object.keys(report).find(id => {
                return report[id].type === 'transport' && report[id].tlsVersion;
            });
            if (transportId) {
                return {
                    dtlsRole: report[transportId].dtlsRole,
                    dtlsVersion: report[transportId].tlsVersion,
                    srtpCipher: report[transportId].srtpCipher,
                };
            }
        }
    })();
    return {
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
        ...dtls,
    };
}

function iceServerFeatures(/* clientTrace*/_, peerConnectionTrace) {
    const configuration = peerConnectionTrace.find(traceEvent => traceEvent.type === 'create')?.value;
    if (!configuration?.iceServers) return {};
    const configured = {
        configuredIceServers: configuration.iceServers.length,
        configuredIceTransportPolicy: configuration.iceTransportPolicy === 'relay',
    };
    for (const iceServer of configuration.iceServers) {
        if (!iceServer.urls) continue;
        const urls = typeof iceServer.urls === 'string' ? [iceServer.urls] : iceServer.urls;
        for (const url of urls) {
            if (url.startsWith('stun:')) {
                configured['configuredIceServersStun'] = true;
            } else if (url.startsWith('turns:')) {
                configured['configuredIceServersTurns'] = true;
            } else if (url.startsWith('turn:')) {
                if (url.endsWith('?transport=udp')) {
                    configured['configuredIceServersTurnUdp'] = true;
                } else if (url.endsWith('?transport=tcp')) {
                    configured['configuredIceServersTurnTcp'] = true;
                }
            }
        }
    }
    return configured;
}

function candidateFeatures(/* clientTrace*/_, peerConnectionTrace) {
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
        addedNullCandidate: peerConnectionTrace.find(traceEvent => {
            return traceEvent.type === 'addIceCandidate' && traceEvent.value === null;
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
            const stats = getSelectedCandidatePairStats(report);
            if (stats) {
                const candidatePair = report[stats.selectedCandidatePairId];
                const localCandidate = report[candidatePair.localCandidateId];
                const remoteCandidate = report[candidatePair.remoteCandidateId];
                return {
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
        }
        return {};
    })();
    return {
        ...candidates,
        ...firstCandidatePair,
    };
}

function lastStatsFeatures(/* clientTrace*/_, peerConnectionTrace) {
    // Find the last stats and extract stats events (typically averages over the whole duration).
    const features = {};
    let lastStatsEvent;
    let lastCandidatePairStats;
    for (let i = peerConnectionTrace.length - 1; i >= 0; i--) {
        const traceEvent = peerConnectionTrace[i];
        if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
        const stats = getSelectedCandidatePairStats(traceEvent.value);
        if (!stats) continue;
        lastStatsEvent = traceEvent;
        lastCandidatePairStats = traceEvent.value[stats.selectedCandidatePairId];
        break;
    }
    if (!(lastStatsEvent && lastCandidatePairStats)) {
        return features;
    }
    features['averageStunRoundTripTime'] = pluckStat(lastCandidatePairStats, ['totalRoundTripTime']) / pluckStat(lastCandidatePairStats, ['responsesReceived']);
    return features;
}

function setLocalDescriptionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    let first;
    let second;
    for (first = 0; first < peerConnectionTrace.length; first++) {
        if (peerConnectionTrace[first].type === 'setLocalDescription') {
            break;
        }
    }
    if (first >= peerConnectionTrace.length) {
        return;
    }
    for (second = first + 1; second < peerConnectionTrace.length; second++) {
        if (peerConnectionTrace[second].type === 'setLocalDescriptionOnSuccess' &&
            peerConnectionTrace[second].extra?.[0] === peerConnectionTrace[first].extra?.[0]) {
            break;
        }
    }
    if (second >= peerConnectionTrace.length) {
        return;
    }
    return {
        setLocalDescriptionDelay: peerConnectionTrace[second].timestamp - peerConnectionTrace[first].timestamp,
        setLocalDescriptionRole: peerConnectionTrace[first].value?.type,
    };
}

function setRemoteDescriptionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    let first;
    let second;
    for (first = 0; first < peerConnectionTrace.length; first++) {
        if (peerConnectionTrace[first].type === 'setRemoteDescription') {
            break;
        }
    }
    if (first >= peerConnectionTrace.length) {
        return;
    }
    for (second = first + 1; second < peerConnectionTrace.length; second++) {
        if (peerConnectionTrace[second].type === 'setRemoteDescriptionOnSuccess' &&
            peerConnectionTrace[second].extra?.[0] === peerConnectionTrace[first].extra?.[0]) {
            break;
        }
    }
    if (second >= peerConnectionTrace.length) {
        return;
    }
    return {
        setRemoteDescriptionDelay: peerConnectionTrace[second].timestamp - peerConnectionTrace[first].timestamp,
        setRemoteDescriptionRole: peerConnectionTrace[first].value?.type,
    };
}


function signalingDelay(/* clientTrace*/_, peerConnectionTrace) {
    // (First) signaling delay, i.e. time it takes to do O/A.
    // Signaling delay can only measure offer->answer.
    let first;
    let second;
    for (first = 0; first < peerConnectionTrace.length; first++) {
        if (peerConnectionTrace[first].type === 'setLocalDescription' &&
            peerConnectionTrace[first].value?.type === 'offer') {
            break;
        }
    }
    if (first >= peerConnectionTrace.length) {
        return;
    }
    for (second = first + 1; second < peerConnectionTrace.length; second++) {
        if (peerConnectionTrace[second].type === 'setRemoteDescription' &&
            peerConnectionTrace[second].value?.type === 'answer') {
            break;
        }
    }
    if (second >= peerConnectionTrace.length) {
        return;
    }
    return peerConnectionTrace[second].timestamp - peerConnectionTrace[first].timestamp;
}

export function extractConnectionFeatures(/* clientTrace*/_, peerConnectionTrace) {
    // A trace will always have at least one event.
    return {
        ... apiFailures(undefined, peerConnectionTrace),
        ... connectionFeatures(undefined, peerConnectionTrace),
        // Whether the peer connection was closed using `pc.close()`.
        closed: peerConnectionTrace[peerConnectionTrace.length - 1].type === 'close',
        // The lifetime of the peer connection in milliseconds.
        duration: peerConnectionTrace[peerConnectionTrace.length - 1].timestamp - peerConnectionTrace[0].timestamp,
        ...iceFeatures(undefined, peerConnectionTrace),
        ... iceServerFeatures(undefined, peerConnectionTrace),
        ...candidateFeatures(undefined, peerConnectionTrace),
        ...lastStatsFeatures(undefined, peerConnectionTrace),
        // The total number of events in the peer connection trace.
        numberOfEvents: peerConnectionTrace.length,
        // The number of events in the peer connection trace excluding periodic 'getStats'.
        numberOfEventsNotGetStats: peerConnectionTrace.filter(traceEvent => traceEvent.type !== 'getStats').length,
        ... setLocalDescriptionFeatures(undefined, peerConnectionTrace),
        ... setRemoteDescriptionFeatures(undefined, peerConnectionTrace),
        signalingDelay: signalingDelay(undefined, peerConnectionTrace),
        // The timestamp at which the peer connection was created.
        startTime: peerConnectionTrace[0].timestamp,
    };
}
