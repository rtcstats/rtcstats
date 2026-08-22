import {truncateStatsValue, truncateStatsReport} from '../precision.js';

describe('precision', () => {
    describe('truncateStatsValue', () => {
        it('passes non-numbers through unchanged', () => {
            expect(truncateStatsValue('mimeType', 'audio/opus')).to.equal('audio/opus');
            expect(truncateStatsValue('active', true)).to.equal(true);
            expect(truncateStatsValue('someObject', {a: 1})).to.deep.equal({a: 1});
            expect(truncateStatsValue('missing', undefined)).to.equal(undefined);
            expect(truncateStatsValue('missing', null)).to.equal(null);
        });

        it('passes integers through unchanged', () => {
            expect(truncateStatsValue('bytesReceived', 123456)).to.equal(123456);
            // Even for integer-class properties, integers are untouched.
            expect(truncateStatsValue('timestamp', 1783323850971)).to.equal(1783323850971);
        });

        it('passes Infinity and NaN through unchanged', () => {
            expect(truncateStatsValue('jitter', Infinity)).to.equal(Infinity);
            expect(truncateStatsValue('jitter', -Infinity)).to.equal(-Infinity);
            expect(Number.isNaN(truncateStatsValue('jitter', NaN))).to.equal(true);
        });

        it('rounds Class A properties to integer', () => {
            expect(truncateStatsValue('timestamp', 1783323850971.656)).to.equal(1783323850972);
            expect(truncateStatsValue('availableOutgoingBitrate', 1234567.89)).to.equal(1234568);
            expect(truncateStatsValue('remoteTimestamp', 42.4)).to.equal(42);
        });

        it('rounds Class B properties to 5 significant digits', () => {
            // audioLevel quantized to a multiple of 1/32768.
            expect(truncateStatsValue('audioLevel', 0.00003051850947599719))
                .to.equal(0.000030519);
            // totalAudioEnergy with a tiny increment keeps its magnitude.
            expect(truncateStatsValue('totalAudioEnergy', 0.0000000012345678))
                .to.equal(0.0000000012346);
        });

        it('rounds Class C properties to 6 decimals', () => {
            // jitter ~ multiples of 1/48000, too fine for millisecond rounding.
            expect(truncateStatsValue('jitter', 0.0208333333333))
                .to.equal(0.020833);
        });

        it('rounds Class D (default) properties to 3 decimals', () => {
            expect(truncateStatsValue('totalSamplesDuration', 1.0000000000000007))
                .to.equal(1);
            expect(truncateStatsValue('totalDecodeTime', 0.1234567))
                .to.equal(0.123);
            expect(truncateStatsValue('currentRoundTripTime', 0.0123456789))
                .to.equal(0.012);
            expect(truncateStatsValue('roundTripTime', 0.15678))
                .to.equal(0.157);
            expect(truncateStatsValue('totalRoundTripTime', 12.34567))
                .to.equal(12.346);
            // An unknown float property also falls to the 3-decimal default.
            expect(truncateStatsValue('googSomething', 0.98765))
                .to.equal(0.988);
        });
    });

    describe('truncateStatsReport', () => {
        it('rounds every own numeric property in place and returns the object', () => {
            const report = {
                type: 'inbound-rtp',
                timestamp: 1783323850971.656,
                audioLevel: 0.00003051850947599719,
                jitter: 0.0208333333333,
                totalSamplesDuration: 1.0000000000000007,
                packetsReceived: 100,
                decoderImplementation: 'libvpx',
            };
            const returned = truncateStatsReport(report);
            expect(returned).to.equal(report);
            expect(report).to.deep.equal({
                type: 'inbound-rtp',
                timestamp: 1783323850972,
                audioLevel: 0.000030519,
                jitter: 0.020833,
                totalSamplesDuration: 1,
                packetsReceived: 100,
                decoderImplementation: 'libvpx',
            });
        });

        it('leaves nested object members untouched', () => {
            const report = {
                qualityLimitationDurations: {cpu: 1.5, none: 2.25},
            };
            truncateStatsReport(report);
            expect(report.qualityLimitationDurations).to.deep.equal({cpu: 1.5, none: 2.25});
        });
    });
});
