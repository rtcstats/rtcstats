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
            keyFramesEncoded: 1,
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
            firCount: 0,
            nackCount: 3,
            pliCount: 1,
            qpSum: 3251,
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
            firCount: 0,
            frameCount: 100,
            keyFrameCount: 1,
            kind: 'video',
            maxHeight: 240,
            maxWidth: 320,
            minHeight: 240,
            minWidth: 320,
            nackCount: 3,
            otherQualityLimitationPercentage: 0.35,
            pliCount: 1,
            qpSum: 3251,
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
                psnrMeasurements: 2,
                psnrSum: {y: 32, u: 31, v: 26},
                psnrMeasurements: 2,
                psnrSumY: 32,
                psnrSumU: 31,
                psnrSumV: 26,
                powerEfficientEncoder: false,
                encoderImplementation: 'bogus',
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
            expect(features.powerEfficientEncoder).to.equal(false);
            expect(features.encoderImplementation).to.equal('bogus');
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
                framesDropped: 2,
                totalDecodeTime: 20,
                totalInterFrameDelay: 5,
                freezeCount: 1,
                totalFreezesDuration: 30,
                powerEfficientDecoder: true,
                decoderImplementation: 'some hardware',
                jitterBufferDelay: 10,
                jitterBufferMinimumDelay: 1,
                jitterBufferTargetDelay: 2,
                jitterBufferEmittedCount: 100,
                jitterBufferFlushes: 3,
                totalProcessingDelay: 5,
                framesAssembledFromMultiplePackets: 50,
                totalAssemblyTime: 2.5,
            }
        };
        it('should extract decode-related features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.averageDecodeTime).to.equal(0.2);
            expect(features.averageInterFrameDelay).to.equal(0.05);
            expect(features.framesDropped).to.equal(2);
        });
        it('should extract freeze-related features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.freezeCount).to.equal(1);
            expect(features.totalFreezesDuration).to.equal(30);
            expect(features.powerEfficientDecoder).to.equal(true);
            expect(features.decoderImplementation).to.equal('some hardware');
        });
        it('should extract jitter buffer and assembly features', () => {
            const pcTrace = [
                { type: 'getStats', timestamp: 1001, value: stats },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.jitterBufferDelay).to.equal(10);
            expect(features.jitterBufferMinimumDelay).to.equal(1);
            expect(features.jitterBufferTargetDelay).to.equal(2);
            expect(features.jitterBufferEmittedCount).to.equal(100);
            expect(features.jitterBufferFlushes).to.equal(3);
            expect(features.totalProcessingDelay).to.equal(5);
            expect(features.averageJitterBufferDelay).to.equal(0.1);
            expect(features.averageProcessingDelay).to.equal(0.05);
            expect(features.framesAssembledFromMultiplePackets).to.equal(50);
            expect(features.totalAssemblyTime).to.equal(2.5);
            expect(features.averageAssemblyTime).to.equal(0.05);
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

    describe('L4S related features', () => {
        it('should extract L4S features for outbound tracks', () => {
            const pcTrace = [
                {
                    type: 'getStats',
                    timestamp: 1001,
                    value: {
                        'track1_stats': {
                            type: 'outbound-rtp',
                            packetsSentWithEct1: 50,
                            remoteId: 'r',
                        },
                        'r': {
                            type: 'remote-inbound-rtp',
                            packetsReceivedWithEct1: 40,
                            packetsReceivedWithCe: 5,
                            packetsWithBleachedEct1Marking: 5,
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.packetsSentWithEct1).to.equal(50);
            expect(features.packetsReceivedWithEct1).to.equal(40);
            expect(features.packetsReceivedWithCe).to.equal(5);
            expect(features.packetsWithBleachedEct1Marking).to.equal(5);
        });
    });

    describe('hasNullVideoDecoder', () => {
        it('should extract hasNullVideoDecoder for inbound video tracks', () => {
            const trackInfo = {
                direction: 'inbound',
                id: 'track1',
                kind: 'video',
                startTime: 1000,
                statsId: 'track1_stats',
            };
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            decoderImplementation: 'NullVideoDecoder',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.hasNullVideoDecoder).to.equal(true);
        });

        it('should return false if NullVideoDecoder was not used', () => {
            const trackInfo = {
                direction: 'inbound',
                id: 'track1',
                kind: 'video',
                startTime: 1000,
                statsId: 'track1_stats',
            };
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            decoderImplementation: 'libvpx',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.hasNullVideoDecoder).to.equal(false);
        });

        it('should return undefined for outbound tracks', () => {
            const trackInfo = {
                direction: 'outbound',
                id: 'track1',
                kind: 'video',
                startTime: 1000,
                statsId: 'track1_stats',
            };
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            decoderImplementation: 'NullVideoDecoder',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.hasNullVideoDecoder).to.be.undefined;
        });
    });

    describe('audio concealment features', () => {
        const trackInfo = {
            direction: 'inbound',
            id: 'track1',
            kind: 'audio',
            startTime: 1000,
            statsId: 'track1_stats',
        };
        it('should extract concealment features for inbound audio tracks', () => {
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            concealedSamples: 1473,
                            insertedSamplesForDeceleration: 981,
                            removedSamplesForAcceleration: 327,
                            totalSamplesReceived: 49050,
                            type: 'inbound-rtp',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.concealedSamples).to.equal(1473);
            expect(features.totalSamplesReceived).to.equal(49050);
            expect(features.concealmentPercentage).to.equal(1473 / 49050);
            expect(features.insertedSamplesForDeceleration).to.equal(981);
            expect(features.removedSamplesForAcceleration).to.equal(327);
            expect(features.decelerationPercentage).to.equal(981 / 49050);
            expect(features.accelerationPercentage).to.equal(327 / 49050);
        });

        it('should return undefined for time-stretching features if the sample counts are missing', () => {
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            concealedSamples: 1473,
                            totalSamplesReceived: 49050,
                            type: 'inbound-rtp',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.insertedSamplesForDeceleration).to.be.undefined;
            expect(features.removedSamplesForAcceleration).to.be.undefined;
            expect(features.decelerationPercentage).to.be.undefined;
            expect(features.accelerationPercentage).to.be.undefined;
        });

        it('should return undefined if concealedSamples is missing', () => {
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            totalSamplesReceived: 49050,
                            type: 'inbound-rtp',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.concealedSamples).to.be.undefined;
            expect(features.concealmentPercentage).to.be.undefined;
        });

        it('should return undefined for outbound tracks', () => {
            const outboundTrackInfo = {
                direction: 'outbound',
                id: 'track1',
                kind: 'audio',
                startTime: 1000,
                statsId: 'track1_stats',
            };
            const pcTrace = [
                {
                    timestamp: 1001,
                    type: 'getStats',
                    value: {
                        'track1_stats': {
                            concealedSamples: 1473,
                            insertedSamplesForDeceleration: 981,
                            removedSamplesForAcceleration: 327,
                            totalSamplesReceived: 49050,
                            type: 'outbound-rtp',
                        },
                    },
                },
            ];
            const features = extractTrackFeatures([], pcTrace, outboundTrackInfo);
            expect(features.concealedSamples).to.be.undefined;
            expect(features.totalSamplesReceived).to.be.undefined;
            expect(features.concealmentPercentage).to.be.undefined;
            expect(features.insertedSamplesForDeceleration).to.be.undefined;
            expect(features.removedSamplesForAcceleration).to.be.undefined;
            expect(features.decelerationPercentage).to.be.undefined;
            expect(features.accelerationPercentage).to.be.undefined;
        });
    });

    describe('audio jitter buffer flush features', () => {
        const trackInfo = {
            direction: 'inbound',
            id: 'track1',
            kind: 'audio',
            startTime: 1000,
            statsId: 'track1_stats',
        };
        // getStats is polled once a second; jitterBufferFlushes steps up every flushIntervalMs.
        const traceFromFlushes = (flushes, flushIntervalMs = 4000) => {
            const trace = [];
            for (let t = 0; t <= flushes * flushIntervalMs; t += 1000) {
                trace.push({
                    timestamp: 1000 + t,
                    type: 'getStats',
                    value: {'track1_stats': {jitterBufferFlushes: Math.floor(t / flushIntervalMs), type: 'inbound-rtp'}},
                });
            }
            return trace;
        };

        it('detects a roughly four-second flush cadence', () => {
            const features = extractTrackFeatures([], traceFromFlushes(5), trackInfo);
            expect(features.hasPeriodicJitterBufferFlushes).to.equal(true);
        });

        it('does not flag flushes that are too far apart', () => {
            const features = extractTrackFeatures([], traceFromFlushes(4, 8000), trackInfo);
            expect(features.hasPeriodicJitterBufferFlushes).to.equal(false);
        });
    });

    describe('timeToFirstFrame', () => {
        const trackInfo = {
            direction: 'inbound',
            id: 'track1',
            kind: 'video',
            startTime: 1000,
            statsId: 'track1_stats',
        };

        it('should extract the delta between ontrack and the unmute event', () => {
            const pcTrace = [
                {timestamp: 2200, type: 'MediaStreamTrack.onunmute', value: 'track1'},
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.timeToFirstFrame).to.equal(1200);
        });

        it('should return undefined if there is no unmute event', () => {
            const features = extractTrackFeatures([], [], trackInfo);
            expect(features.timeToFirstFrame).to.be.undefined;
        });

        it('should return undefined for outbound tracks', () => {
            const outboundTrackInfo = {
                direction: 'outbound',
                id: 'track1',
                kind: 'video',
                startTime: 1000,
                statsId: 'track1_stats',
            };
            const pcTrace = [
                {timestamp: 2200, type: 'MediaStreamTrack.onunmute', value: 'track1'},
            ];
            const features = extractTrackFeatures([], pcTrace, outboundTrackInfo);
            expect(features.timeToFirstFrame).to.be.undefined;
        });

        it('should ignore unmute events for other tracks', () => {
            const pcTrace = [
                {timestamp: 2200, type: 'MediaStreamTrack.onunmute', value: 'track2'},
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.timeToFirstFrame).to.be.undefined;
        });

        it('should use the first unmute event when the track mutes and unmutes again', () => {
            const pcTrace = [
                {timestamp: 2200, type: 'MediaStreamTrack.onunmute', value: 'track1'},
                {timestamp: 3000, type: 'MediaStreamTrack.onmute', value: 'track1'},
                {timestamp: 4000, type: 'MediaStreamTrack.onunmute', value: 'track1'},
                {timestamp: 5000, type: 'MediaStreamTrack.onmute', value: 'track1'},
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.timeToFirstFrame).to.equal(1200);
        });

        it('should return undefined if the unmute event predates the track', () => {
            const pcTrace = [
                {timestamp: 900, type: 'MediaStreamTrack.onunmute', value: 'track1'},
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.timeToFirstFrame).to.be.undefined;
        });
    });

    describe('echo cancellation features', () => {
        const ERLE_FLOOR = 0.17551203072071075;
        const trackInfo = {
            direction: 'outbound',
            id: 'track1',
            kind: 'audio',
            startTime: 1000,
            statsId: 'track1_stats',
        };
        const traceFromErle = (values) => values.map((erle, index) => ({
            timestamp: 1000 + index * 1000,
            type: 'getStats',
            value: {
                'track1_source': {echoReturnLossEnhancement: erle, type: 'media-source'},
                'track1_stats': {mediaSourceId: 'track1_source', type: 'outbound-rtp'},
            },
        }));

        it('reports zero coverage and no median when the estimator never left the floor', () => {
            const features = extractTrackFeatures([], traceFromErle(new Array(20).fill(ERLE_FLOOR)), trackInfo);
            expect(features.echoReturnLossEnhancementCoverage).to.equal(0);
            expect(features.echoReturnLossEnhancement).to.be.undefined;
        });

        it('takes the median of the above-floor samples only', () => {
            const features = extractTrackFeatures([], traceFromErle([
                ERLE_FLOOR, 12, ERLE_FLOOR, 18, 20, ERLE_FLOOR,
            ]), trackInfo);
            expect(features.echoReturnLossEnhancement).to.equal(18);
            expect(features.echoReturnLossEnhancementCoverage).to.equal(0.5);
        });

        it('takes the upper of the two middle samples for an even count', () => {
            const features = extractTrackFeatures([], traceFromErle([12, 18, 20, 24]), trackInfo);
            expect(features.echoReturnLossEnhancement).to.equal(20);
            expect(features.echoReturnLossEnhancementCoverage).to.equal(1);
        });

        it('should return no features when there is no media-source entry', () => {
            const pcTrace = [
                {timestamp: 2000, type: 'getStats', value: {'track1_stats': {mediaSourceId: 'track1_source', type: 'outbound-rtp'}}},
            ];
            const features = extractTrackFeatures([], pcTrace, trackInfo);
            expect(features.echoReturnLossEnhancement).to.be.undefined;
            expect(features.echoReturnLossEnhancementCoverage).to.be.undefined;
        });

        it('should return no features for inbound audio', () => {
            const inboundTrackInfo = {...trackInfo, direction: 'inbound'};
            const features = extractTrackFeatures([], traceFromErle([12, 18, 20]), inboundTrackInfo);
            expect(features.echoReturnLossEnhancement).to.be.undefined;
            expect(features.echoReturnLossEnhancementCoverage).to.be.undefined;
        });

        it('should return no features for outbound video', () => {
            const videoTrackInfo = {...trackInfo, kind: 'video'};
            const features = extractTrackFeatures([], traceFromErle([12, 18, 20]), videoTrackInfo);
            expect(features.echoReturnLossEnhancement).to.be.undefined;
            expect(features.echoReturnLossEnhancementCoverage).to.be.undefined;
        });

        it('keeps two outbound audio tracks apart', () => {
            const report = (erleA, erleB) => ({
                'trackA_source': {echoReturnLossEnhancement: erleA, type: 'media-source'},
                'trackA_stats': {mediaSourceId: 'trackA_source', type: 'outbound-rtp'},
                'trackB_source': {echoReturnLossEnhancement: erleB, type: 'media-source'},
                'trackB_stats': {mediaSourceId: 'trackB_source', type: 'outbound-rtp'},
            });
            const pcTrace = [
                {timestamp: 2000, type: 'getStats', value: report(20, ERLE_FLOOR)},
                {timestamp: 3000, type: 'getStats', value: report(22, ERLE_FLOOR)},
                {timestamp: 4000, type: 'getStats', value: report(24, ERLE_FLOOR)},
            ];
            const track = (id) => ({direction: 'outbound', id, kind: 'audio', startTime: 1000, statsId: id + '_stats'});
            const a = extractTrackFeatures([], pcTrace, track('trackA'));
            const b = extractTrackFeatures([], pcTrace, track('trackB'));
            expect(a.echoReturnLossEnhancement).to.equal(22);
            expect(a.echoReturnLossEnhancementCoverage).to.equal(1);
            expect(b.echoReturnLossEnhancement).to.be.undefined;
            expect(b.echoReturnLossEnhancementCoverage).to.equal(0);
        });

        it('is invariant to the polling rate', () => {
            // A plateau with two estimator resets and their re-convergence ramps, the shape
            // a real ERLE series has. A mean would move with the stride, the median does not.
            const series = [];
            for (let i = 0; i < 150; i++) {
                if (i === 40 || i === 95) {
                    series.push(ERLE_FLOOR, 4.5, 9.5, 14);
                } else {
                    series.push(17.5 + (i % 7) * 0.25);
                }
            }
            const full = extractTrackFeatures([], traceFromErle(series), trackInfo);
            const decimated = extractTrackFeatures([], traceFromErle(series.filter((_, i) => i % 5 === 0)), trackInfo);
            expect(Math.abs(full.echoReturnLossEnhancement - decimated.echoReturnLossEnhancement)).to.be.below(0.5);
        });
    });
});
