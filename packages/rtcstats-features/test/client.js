import {extractClientFeatures} from '../features.js';

describe('extractClientFeatures', () => {
    it('should extract basic client features correctly', () => {
        const clientTrace = [
            { type: 'create', value: { startTime: 1000, duration: 500, userAgentData: 'ua', hardwareConcurrency: 4, deviceMemory: 8, screen: 'screen', window: 'window', reloadCount: 3 }, timestamp: 1000 },
            { type: 'navigator.mediaDevices.getUserMedia', value: { audio: true, video: false }, timestamp: 1001 },
            { type: 'navigator.mediaDevices.getUserMediaOnSuccess', value: [], timestamp: 1002 },
            { type: 'navigator.mediaDevices.getDisplayMedia', value: { video: true }, timestamp: 1003 },
            { type: 'navigator.mediaDevices.getDisplayMediaOnSuccess', value: [], timestamp: 1004 },
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
            reloadCount: 3,
            webSocketConnectionTime: undefined,
            calledGetUserMedia: true,
            calledGetUserMediaAudio: true,
            calledGetUserMediaCombined: false,
            calledGetUserMediaVideo: false,
            getUserMediaError: 'NotAllowedError',
            getUserMediaErrorCount: 1,
            getUserMediaSuccessCount: 1,
            calledGetDisplayMedia: true,
            calledGetDisplayMediaAudio: false,
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
            webSocketConnectionTime: undefined,
            calledGetUserMedia: false,
            calledGetUserMediaAudio: false,
            calledGetUserMediaCombined: false,
            calledGetUserMediaVideo: false,
            getUserMediaError: undefined,
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

    it('should not count an absent constraint as requested', () => {
        const clientTrace = [
            { type: 'create', value: { startTime: 1000 }, timestamp: 1000 },
            { type: 'navigator.mediaDevices.getUserMedia', value: { video: true }, timestamp: 1001 },
            { type: 'navigator.mediaDevices.getUserMedia', value: { audio: true }, timestamp: 1002 },
            { type: 'navigator.mediaDevices.getDisplayMedia', value: { video: true }, timestamp: 1003 },
            { timestamp: 1004 }
        ];

        const features = extractClientFeatures(clientTrace);

        // getUserMedia({video: true}) does not request audio; {audio: true} does not request video.
        expect(features.calledGetUserMediaAudio).to.be.true;
        expect(features.calledGetUserMediaVideo).to.be.true;
        expect(features.calledGetUserMediaCombined).to.be.false;
        // getDisplayMedia audio defaults off, so an absent audio constraint is not a request.
        expect(features.calledGetDisplayMediaAudio).to.be.false;
        expect(features.calledGetDisplayMediaVideo).to.be.true;
    });

    it('should extract track features (ended and short duration)', () => {
        const clientTrace = [
            { type: 'create', value: { startTime: 1000 }, timestamp: 1000 },
            {
                type: 'navigator.mediaDevices.getUserMediaOnSuccess',
                value: [
                    ['audio', 'audio-id', 'label', 'stream-id'],
                    ['video', 'video-id', 'label', 'stream-id']
                ],
                timestamp: 1100
            },
            {
                type: 'MediaStreamTrack.onended',
                value: 'audio-id',
                timestamp: 1500 // 400ms duration
            },
            {
                type: 'MediaStreamTrack.onended',
                value: 'video-id',
                timestamp: 2500 // 1400ms duration
            }
        ];

        const features = extractClientFeatures(clientTrace);

        expect(features.audioEnded).to.be.true;
        expect(features.audioShortDuration).to.be.true;
        expect(features.videoEnded).to.be.true;
        expect(features.videoShortDuration).to.be.undefined;
    });
});
