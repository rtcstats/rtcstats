import {extractTrackFeatures} from '../features.js';

describe('extractTrackFeatures', () => {
    const trackInfo = {
        id: 'track1',
        kind: 'video',
        direction: 'outbound',
        startTime: 1000,
        statsId: 'track1_stats',
    };
    const stats = {
        [trackInfo.statsId]: {
            framesEncoded: 100,
            totalEncodeTime: 10,
            frameWidth: 320,
            frameHeight: 240,
            qualityLimitationDurations: {
                bandwidth: 100,
                cpu: 200,
                none: 1000,
                other: 700,
            },
            qualityLimitationResolutionChanges: 1,
        }
    };

    it('should extract features for a track', () => {
        const pcTrace = [
            { type: 'getStats', timestamp: 1001, value: stats },
            { type: 'getStats', timestamp: 1002, value: stats },
            { type: 'getStats', timestamp: 1003, value: {}},
        ];
        const features = extractTrackFeatures([], pcTrace, trackInfo);
        Object.keys(features).forEach(name => {
            if (features[name] === undefined) delete features[name];
        });
        expect(features).to.deep.equal({
            averageEncodeTime: 0.1,
            bandwidthQualityLimitationPercentage: 0.05,
            commonHeight: 240,
            commonWidth: 320,
            cpuQualityLimitationPercentage: 0.1,
            direction: 'outbound',
            duration: 2,
            frameCount: 100,
            kind: 'video',
            maxHeight: 240,
            maxWidth: 320,
            minHeight: 240,
            minWidth: 320,
            otherQualityLimitationPercentage: 0.35,
            qualityLimitationResolutionChanges: 1,
            startTime: 1000,
            trackIdentifier: 'track1',
        });
    });

    it('should have a duration of 0 if no getStats are present', () => {
        const pcTrace = [
            { type: 'createOffer', timestamp: 1001 },
        ];
        const features = extractTrackFeatures([], pcTrace, trackInfo);
        expect(features.duration).to.equal(0);
    });

    describe('for outbound tracks', () => {
        const trackInfo = {
            id: 'track1',
            kind: 'video',
            direction: 'outbound',
            startTime: 1000,
            statsId: 'track1_stats',
        };
        const stats = {
            [trackInfo.statsId]: {
                type: 'outbound-rtp',
                framesEncoded: 100,
                totalEncodeTime: 10,
                qualityLimitationDurations: {
                    bandwidth: 100,
                    cpu: 200,
                    none: 1000,
                    other: 700,
                },
                qualityLimitationResolutionChanges: 1,
                rid: 'f',
                encodingIndex: 0,
            }
        };

        it('should extract encode-related features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.averageEncodeTime).to.equal(0.1);
            expect(features.bandwidthQualityLimitationPercentage).to.equal(0.05);
            expect(features.cpuQualityLimitationPercentage).to.equal(0.1);
            expect(features.otherQualityLimitationPercentage).to.equal(0.35);
            expect(features.qualityLimitationResolutionChanges).to.equal(1);
            expect(features.rid).to.equal('f');
            expect(features.encodingIndex).to.equal(0);
        });
    });

    describe('for inbound tracks', () => {
        const trackInfo = {
            id: 'track1',
            kind: 'video',
            direction: 'inbound',
            startTime: 1000,
            statsId: 'track1_stats',
        };
        const stats = {
            [trackInfo.statsId]: {
                type: 'inbound-rtp',
                framesDecoded: 100,
                totalDecodeTime: 20,
                freezeCount: 1,
                totalFreezesDuration: 30,
            }
        };
        it('should extract decode-related features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.averageDecodeTime).to.equal(0.2);
        });
        it('should extract freeze-related features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.freezeCount).to.equal(1);
            expect(features.totalFreezesDuration).to.equal(30);
        });
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
