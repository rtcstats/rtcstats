import {
    extractClientFeatures,
    extractConnectionFeatures,
    extractTrackFeatures,
} from '../features.js';

describe('features.js', () => {
    describe('extractClientFeatures', () => {
        it('should extract basic client features correctly', () => {
            const clientTrace = [
                { type: 'create', value: { startTime: 1000, duration: 500, userAgentData: 'ua', hardwareConcurrency: 4, deviceMemory: 8, screen: 'screen', window: 'window' }, timestamp: 1000 },
                { type: 'navigator.mediaDevices.getUserMedia', value: { audio: true, video: false }, timestamp: 1001 },
                { type: 'navigator.mediaDevices.getUserMediaOnSuccess', timestamp: 1002 },
                { type: 'navigator.mediaDevices.getDisplayMedia', value: { video: true }, timestamp: 1003 },
                { type: 'navigator.mediaDevices.getDisplayMediaOnSuccess', timestamp: 1004 },
                { type: 'navigator.mediaDevices.enumerateDevices', timestamp: 1005 },
                { type: 'navigator.mediaDevices.getUserMediaOnFailure', timestamp: 1006, value: 'NotAllowedError' },
            ];

            const features = extractClientFeatures(clientTrace);

            expect(features).to.deep.equal({
                startTime: 1000,
                duration: 6,
                userAgentData: 'ua',
                hardwareConcurrency: 4,
                deviceMemory: 8,
                screen: 'screen',
                window: 'window',
                calledGetUserMedia: true,
                calledGetUserMediaAudio: true,
                calledGetUserMediaCombined: false,
                calledGetUserMediaVideo: false,
                getUserMediaError: 'NotAllowedError',
                getUserMediaErrorCount: 1,
                getUserMediaSuccessCount: 1,
                calledGetDisplayMedia: true,
                calledGetDisplayMediaAudio: true,
                calledGetDisplayMediaVideo: true,
                getDisplayMediaErrorCount: 0,
                getDisplayMediaSuccessCount: 1,
                enumerateDevicesCount: 1
            });
        });

        it('should handle traces with no getUserMedia or getDisplayMedia calls', () => {
            const clientTrace = [
                { type: 'create', value: { startTime: 1000, duration: 500, userAgentData: 'ua', hardwareConcurrency: 4, deviceMemory: 8, screen: 'screen', window: 'window' }, timestamp: 1000 },
                { timestamp: 1007 }
            ];

            const features = extractClientFeatures(clientTrace);

            expect(features).to.deep.equal({
                startTime: 1000,
                duration: 7,
                userAgentData: 'ua',
                hardwareConcurrency: 4,
                deviceMemory: 8,
                screen: 'screen',
                window: 'window',
                calledGetUserMedia: false,
                calledGetUserMediaAudio: false,
                calledGetUserMediaCombined: false,
                calledGetUserMediaVideo: false,
                getUserMediaError: '',
                getUserMediaErrorCount: 0,
                getUserMediaSuccessCount: 0,
                calledGetDisplayMedia: false,
                calledGetDisplayMediaAudio: false,
                calledGetDisplayMediaVideo: false,
                getDisplayMediaErrorCount: 0,
                getDisplayMediaSuccessCount: 0,
                enumerateDevicesCount: 0
            });
        });

        it('should handle combined audio and video in getUserMedia', () => {
            const clientTrace = [
                { type: 'create', value: { startTime: 1000, duration: 500, userAgentData: 'ua', hardwareConcurrency: 4, deviceMemory: 8, screen: 'screen', window: 'window' }, timestamp: 1000 },
                { type: 'navigator.mediaDevices.getUserMedia', value: { audio: true, video: true }, timestamp: 1001 },
                { timestamp: 1002 }
            ];

            const features = extractClientFeatures(clientTrace);

            expect(features.calledGetUserMediaCombined).to.be.true;
            expect(features.calledGetUserMediaAudio).to.be.true;
            expect(features.calledGetUserMediaVideo).to.be.true;
        });
    });

    describe('extractConnectionFeatures', () => {
        it('should extract features from a simple trace', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
                { type: 'setLocalDescription', timestamp: 1001 },
                { type: 'getStats', timestamp: 1002 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features).to.deep.equal({
                closed: false,
                duration: 2,
                iceConnected: false,
                iceConnectionTime: 0,
                iceRestart: false,
                numberOfEvents: 3,
                numberOfEventsNotGetStats: 2,
                startTime: 1000,
                usingIceLite: false,
                addIceCandidateFailure: '',
                setLocalDescriptionFailure: '',
                setRemoteDescriptionFailure: '',
                connectionTime: 0,
                dtlsVersion: '',
                dtlsRole: '',
                connected: false,
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

        it('should return 0 for ice connection time if no connected state is found', () => {
            const pcTrace = [
                { type: 'oniceconnectionstatechange', value: 'checking', timestamp: 1000 },
                { type: 'oniceconnectionstatechange', value: 'disconnected', timestamp: 1010 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.iceConnectionTime).to.equal(0);
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

        it('should return 0 for DTLS connection time if no connected state is found', () => {
            const pcTrace = [
                { type: 'onconnectionstatechange', value: 'connecting', timestamp: 1000 },
                { type: 'onconnectionstatechange', value: 'disconnected', timestamp: 1010 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.connectionTime).to.equal(0);
        });

        it('should extract DTLS version', () => {
            const pcTrace = [
                { type: 'getStats', value: {
                    'transport_1': {
                        type: 'transport',
                        dtlsVersion: 'FEFD'
                    }
                }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.dtlsVersion).to.equal('FEFD');
        });

        it('should not extract DTLS version if not present', () => {
            const pcTrace = [
                { type: 'getStats', value: {
                    'transport_1': {
                        type: 'transport',
                    }
                }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.dtlsVersion).to.equal('');
        });

        it('should extract addIceCandidateFailure', () => {
            const pcTrace = [
                { type: 'addIceCandidateOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addIceCandidateFailure).to.equal('error message');
        });

        it('should not extract addIceCandidateFailure if event is not present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.addIceCandidateFailure).to.equal('');
        });

        it('should extract setLocalDescriptionFailure', () => {
            const pcTrace = [
                { type: 'setLocalDescriptionOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setLocalDescriptionFailure).to.equal('error message');
        });

        it('should not extract setLocalDescriptionFailure if event is not present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setLocalDescriptionFailure).to.equal('');
        });

        it('should extract setRemoteDescriptionFailure', () => {
            const pcTrace = [
                { type: 'setRemoteDescriptionOnFailure', value: 'error message', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setRemoteDescriptionFailure).to.equal('error message');
        });

        it('should not extract setRemoteDescriptionFailure if event is not present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.setRemoteDescriptionFailure).to.equal('');
        });

        it('should extract dtlsRole', () => {
            const pcTrace = [
                { type: 'getStats', value: {
                    'transport_1': {
                        type: 'transport',
                        dtlsRole: 'client'
                    }
                }, timestamp: 1000 },
            ];
            const features = extractConnectionFeatures([], pcTrace);
            expect(features.dtlsRole).to.equal('client');
        });
    });

    describe('extractTrackFeatures', () => {
        const trackInfo = {
            id: 'track1',
            kind: 'audio',
            direction: 'sendonly',
            startTime: 1000,
            statsId: 'track1_stats',
        };

        it('should extract features for a track', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: {} },
                { type: 'getStats', timestamp: 1002, value: {} },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features).to.deep.equal({
                direction: 'sendonly',
                duration: 2,
                kind: 'audio',
                startTime: 1000,
                trackId: 'track1',
            });
        });

        it('should have a duration of 0 if no getStats are present', () => {
            const pcTrace = [
                { type: 'createOffer', timestamp: 1001 },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.duration).to.equal(0);
        });

        it('should extract codec information', () => {
            const pcTrace = [
                {
                    type: 'getStats',
                    timestamp: 1001,
                    value: {
                        'track1_stats': {
                            type: 'outbound-rtp',
                            codecId: 'codec1',
                            statsId: 'track1_stats'
                        },
                        'codec1': {
                            type: 'codec',
                            mimeType: 'audio/opus',
                            sdpFmtpLine: 'minptime=10;useinbandfec=1',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.codecMimeType).to.equal('audio/opus');
            expect(features.codecSdpFmtpLine).to.equal('minptime=10;useinbandfec=1');
        });

        it('should handle missing sdpFmtpLine', () => {
            const pcTrace = [
                {
                    type: 'getStats',
                    timestamp: 1001,
                    value: {
                        'track1_stats': {
                            type: 'outbound-rtp',
                            codecId: 'codec1',
                            statsId: 'track1_stats'
                        },
                        'codec1': {
                            type: 'codec',
                            mimeType: 'video/VP8',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.codecMimeType).to.equal('video/VP8');
            expect(features.codecSdpFmtpLine).to.equal('');
        });
    });
});
