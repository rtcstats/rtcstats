import {extractConnectionFeatures} from '../features.js';

describe('extractConnectionFeatures', () => {
    it('should extract features from a simple trace', () => {
        const pcTrace = [
            { type: 'createOffer', timestamp: 1000 },
            { type: 'setLocalDescription', timestamp: 1001 },
            { type: 'getStats', timestamp: 1002 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        // Ignore undefined values.
        Object.keys(features).forEach(name => {
            if (features[name] === undefined) delete features[name];
        });
        expect(features).to.deep.equal({
            addedHost: false,
            addedMdns: false,
            addedSrflx: false,
            addedTurn: false,
            closed: false,
            connected: false,
            duration: 2,
            iceConnected: false,
            gatheredHost: false,
            gatheredMdns: false,
            gatheredSrflx: false,
            gatheredTurn: false,
            iceRestart: false,
            iceRestartFollowedBySetRemoteDescription: false,
            numberOfEvents: 3,
            numberOfEventsNotGetStats: 2,
            startTime: 1000,
            usingIceLite: false,
        });
    });

    it('should identify a closed connection', () => {
        const pcTrace = [
            { type: 'createOffer', timestamp: 1000 },
            { type: 'close', timestamp: 1001 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.closed).to.be.true;
        expect(features.duration).to.equal(1);
    });

    it('should identify a connected connection', () => {
        const pcTrace = [
            { type: 'createOffer', timestamp: 1000 },
            { type: 'oniceconnectionstatechange', value: 'connected', timestamp: 1001 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.iceConnected).to.be.true;
    });

    it('should identify if the remote side uses ice-lite', () => {
        const pcTrace = [
            { type: 'createOffer', timestamp: 1000 },
            { type: 'setRemoteDescription', value: { sdp: 'v=0\r\no=- 12345 12345 IN IP4 127.0.0.1\r\na=ice-lite\r\n' }, timestamp: 1001 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.usingIceLite).to.be.true;
    });

    it('should calculate the ice connection time', () => {
        const pcTrace = [
            { type: 'oniceconnectionstatechange', value: 'checking', timestamp: 1000 },
            { type: 'oniceconnectionstatechange', value: 'connected', timestamp: 1010 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.iceConnectionTime).to.equal(10);
    });

    it('should identify an ice restart', () => {
        const pcTrace = [
            { type: 'createOffer', value: { iceRestart: true }, timestamp: 1000 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.iceRestart).to.be.true;
    });

    it('should identify a connected connection', () => {
        const pcTrace = [
            { type: 'onconnectionstatechange', value: 'connected', timestamp: 1000 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.connected).to.be.true;
    });

    it('should not identify a connected connection if state is not "connected"', () => {
        const pcTrace = [
            { type: 'onconnectionstatechange', value: 'connecting', timestamp: 1000 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.connected).to.be.false;
    });

    it('should calculate the DTLS connection time', () => {
        const pcTrace = [
            { type: 'onconnectionstatechange', value: 'connecting', timestamp: 1000 },
            { type: 'onconnectionstatechange', value: 'connected', timestamp: 1010 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.connectionTime).to.equal(10);
    });

    it('should extract DTLS version and role', () => {
        const pcTrace = [
            { type: 'getStats', value: {
                'transport_1': {
                    type: 'transport',
                    dtlsRole: 'unknown',
                },
            }, timestamp: 100 },
            { type: 'getStats', value: {
                'transport_1': {
                    type: 'transport',
                    dtlsRole: 'client',
                    tlsVersion: 'FEFD',
                    srtpCipher: 'null cipher',
                },
            }, timestamp: 1000 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.dtlsVersion).to.equal('FEFD');
        expect(features.dtlsRole).to.equal('client');
        expect(features.srtpCipher).to.equal('null cipher');
    });

    describe('API failure', () => {
        it('should extract addIceCandidateFailure', () => {
            const pcTrace = [
                { type: 'addIceCandidateOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addIceCandidateFailure).to.equal('error message');
        });

        it('should extract setLocalDescriptionFailure', () => {
            const pcTrace = [
                { type: 'setLocalDescriptionOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setLocalDescriptionFailure).to.equal('error message');
        });

        it('should extract setRemoteDescriptionFailure', () => {
            const pcTrace = [
                { type: 'setRemoteDescriptionOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setRemoteDescriptionFailure).to.equal('error message');
        });
    });

    describe('added candidates', () => {
        it('should return false for all added types if no candidates are present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.false;
            expect(features.addedMdns).to.be.false;
            expect(features.addedSrflx).to.be.false;
            expect(features.addedTurn).to.be.false;
        });

        it('should identify a host candidate', () => {
            const pcTrace = [
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 2122260223 192.168.1.2 9000 typ host' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.true;
            expect(features.addedMdns).to.be.false;
            expect(features.addedSrflx).to.be.false;
            expect(features.addedTurn).to.be.false;
        });

        it('should identify an mDNS candidate', () => {
            const pcTrace = [
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 2122260223 abc.local 9000 typ host' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.true;
            expect(features.addedMdns).to.be.true;
            expect(features.addedSrflx).to.be.false;
            expect(features.addedTurn).to.be.false;
        });

        it('should identify a srflx candidate', () => {
            const pcTrace = [
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ srflx' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.false;
            expect(features.addedMdns).to.be.false;
            expect(features.addedSrflx).to.be.true;
            expect(features.addedTurn).to.be.false;
        });

        it('should identify a relay candidate', () => {
            const pcTrace = [
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ relay' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.false;
            expect(features.addedMdns).to.be.false;
            expect(features.addedSrflx).to.be.false;
            expect(features.addedTurn).to.be.true;
        });

        it('should identify a mix of candidates', () => {
            const pcTrace = [
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 2122260223 192.168.1.2 9000 typ host' }, timestamp: 1000 },
                { type: 'addIceCandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ srflx' }, timestamp: 1001 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addedHost).to.be.true;
            expect(features.addedMdns).to.be.false;
            expect(features.addedSrflx).to.be.true;
            expect(features.addedTurn).to.be.false;
        });
    });

    describe('gathered candidates', () => {
        it('should return false for all gathered types if no candidates are present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.false;
            expect(features.gatheredMdns).to.be.false;
            expect(features.gatheredSrflx).to.be.false;
            expect(features.gatheredTurn).to.be.false;
        });

        it('should identify a host candidate', () => {
            const pcTrace = [
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 2122260223 192.168.1.2 9000 typ host' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.true;
            expect(features.gatheredMdns).to.be.false;
            expect(features.gatheredSrflx).to.be.false;
            expect(features.gatheredTurn).to.be.false;
        });

        it('should identify an mDNS candidate', () => {
            const pcTrace = [
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 2122260223 abc.local 9000 typ host' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.true;
            expect(features.gatheredMdns).to.be.true;
            expect(features.gatheredSrflx).to.be.false;
            expect(features.gatheredTurn).to.be.false;
        });

        it('should identify a srflx candidate', () => {
            const pcTrace = [
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ srflx' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.false;
            expect(features.gatheredMdns).to.be.false;
            expect(features.gatheredSrflx).to.be.true;
            expect(features.gatheredTurn).to.be.false;
        });

        it('should identify a relay candidate', () => {
            const pcTrace = [
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ relay' }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.false;
            expect(features.gatheredMdns).to.be.false;
            expect(features.gatheredSrflx).to.be.false;
            expect(features.gatheredTurn).to.be.true;
        });

        it('should identify a mix of candidates', () => {
            const pcTrace = [
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 2122260223 192.168.1.2 9000 typ host' }, timestamp: 1000 },
                { type: 'onicecandidate', value: { candidate: 'candidate:1 1 udp 1694498815 1.2.3.4 9000 typ srflx' }, timestamp: 1001 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.gatheredHost).to.be.true;
            expect(features.gatheredMdns).to.be.false;
            expect(features.gatheredSrflx).to.be.true;
            expect(features.gatheredTurn).to.be.false;
        });
    });

    describe('configured ICE servers', () => {
        it('should extract configured ICE server features', () => {
            const pcTrace = [
                {
                    type: 'create',
                    value: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: ['turns:global.turn.twilio.com:443?transport=tcp', 'turn:global.turn.twilio.com:3478?transport=udp'] },
                            { urls: 'turn:global.turn.twilio.com:3478?transport=tcp' },
                        ],
                        iceTransportPolicy: 'relay',
                    },
                    timestamp: 1000
                },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.configuredIceServers).to.equal(3);
            expect(features.configuredIceTransportPolicy).to.be.true;
            expect(features.configuredIceServersStun).to.be.true;
            expect(features.configuredIceServersTurns).to.be.true;
            expect(features.configuredIceServersTurnUdp).to.be.true;
            expect(features.configuredIceServersTurnTcp).to.be.true;
        });

        it('should handle no iceServers in configuration', () => {
            const pcTrace = [
                {
                    type: 'create',
                    value: {
                        iceTransportPolicy: 'all',
                    },
                    timestamp: 1000
                },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.configuredIceServers).to.equal(undefined);
        });
    });

    it('should extract first candidate pair stats', () => {
        const pcTrace = [
            {
                type: 'onconnectionstatechange',
                value: 'connected',
                timestamp: 1000,
            },
            {
                type: 'getStats',
                value: {
                    1: { type: 'transport', selectedCandidatePairId: '2' },
                    2: { type: 'candidate-pair', localCandidateId: '3', remoteCandidateId: '4' },
                    3: { type: 'local-candidate', candidateType: 'relay', address: '1.1.1.1', protocol: 'udp', networkType: 'vpn', priority: 1234 },
                    4: { type: 'remote-candidate', candidateType: 'host', address: '2.2.2.2' },
                },
                timestamp: 1001,
            },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.firstCandidatePairLocalType).to.equal('relay');
        expect(features.firstCandidatePairRemoteType).to.equal('host');
        expect(features.firstCandidatePairLocalAddress).to.equal('1.1.1.1');
        expect(features.firstCandidatePairLocalProtocol).to.equal('udp');
        expect(features.firstCandidatePairLocalNetworkType).to.equal('vpn');
        expect(features.firstCandidatePairRemoteAddress).to.equal('2.2.2.2');
    });

    it('should extract last candidate pair stats', () => {
        const pcTrace = [
            {
                type: 'getStats',
                value: {
                    1: { type: 'transport', selectedCandidatePairId: '2' },
                    2: { type: 'candidate-pair', totalRoundTripTime: 100, responsesReceived: 2 },
                },
                timestamp: 1001,
            },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.averageStunRoundTripTime).to.equal(50);
    });

    it('should extract ice restart and whether it was followed by setRemoteDescription', () => {
        const pcTrace = [
            { type: 'createOffer', value: {iceRestart: true}, timestamp: 1000 },
            { type: 'setLocalDescription', value: {type: 'offer', sdp: ''}, timestamp: 1001 },
            { type: 'setRemoteDescription', value: {type: 'answer', sdp: ''}, timestamp: 1002 },
        ];
        const features = extractConnectionFeatures([], pcTrace);
        expect(features.iceRestart).to.equal(true);
        expect(features.iceRestartFollowedBySetRemoteDescription).to.equal(true);
    });
});
