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
                numberOfEvents: 3,
                numberOfEventsNotGetStats: 2,
                startTime: 1000,
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
    });

    describe('extractTrackFeatures', () => {
        const trackInfo = {
            id: 'track1',
            kind: 'audio',
            direction: 'sendonly',
            startTime: 1000,
        };

        it('should extract features for a track', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001 },
                { type: 'getStats', timestamp: 1002 },
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
    });
});
