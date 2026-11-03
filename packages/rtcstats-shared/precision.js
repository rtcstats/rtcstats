// Per-property precision policy for getStats double values.
//
// getStats serializes doubles at full precision, so float noise like
// `"totalSamplesDuration":1.0000000000000007` or
// `"audioLevel":0.00003051850947599719` is paid on every tick. Rounding each
// double to a per-property precision keeps the serialized values compact and,
// as a second-order effect in delta compression, lets values that only jitter
// below the precision threshold drop out of the delta entirely.
//
// This is lossy but not a wire-format change: only the producer rounds,
// decompression is untouched, and old and new readers agree. A flat "3
// decimals" rule does not work (audioLevel and totalAudioEnergy have near-zero
// magnitudes that get wiped out), hence the small per-property override table.
//
// Kept as its own module so it can be shared by rtcstats-js and stay in sync
// with the identical table shipped in Chromium's webrtc-internals frontend.

// Class A: round to integer. Epoch-ms timestamps and bitrate estimates.
const PRECISION_INTEGER = new Set([
    'timestamp',
    'lastPacketSentTimestamp',
    'lastPacketReceivedTimestamp',
    'estimatedPlayoutTimestamp',
    'remoteTimestamp',
    'targetBitrate',
    'availableOutgoingBitrate',
    'availableIncomingBitrate',
]);

// Class B: 5 significant digits. Magnitude spans decades (audioLevel is
// quantized to multiples of 1/32768, totalAudioEnergy increments start around
// 1e-9), so fixed decimals destroy them.
const PRECISION_5SIGNIFICANT = new Set([
    'audioLevel',
    'totalAudioEnergy',
]);

// Class C: 6 decimals. jitter is multiples of 1/clockRate (~20 microseconds
// at 48 kHz), so 1 ms resolution would quantize it away. Round trip times are
// seconds-scale but 1 ms resolution is plenty for them, so they fall to the
// Class D default rather than here.
const PRECISION_6DECIMALS = new Set([
    'jitter',
]);

/**
 * Round a single stats value to the precision appropriate for `property`.
 * Non-numbers, non-finite numbers (Infinity/NaN) and integers are returned
 * unchanged. Class D (3 decimals) is the default for any other non-integer
 * number.
 * @param {string} property - stats property name.
 * @param {*} value - stats value.
 *
 * @returns {*} value rounded to its per-property precision.
 */
export function truncateStatsValue(property, value) {
    if (typeof value !== 'number' || !Number.isFinite(value) ||
            Number.isInteger(value)) {
        return value;
    }
    if (PRECISION_INTEGER.has(property)) {
        return Math.round(value);
    }
    if (PRECISION_5SIGNIFICANT.has(property)) {
        return Number(value.toPrecision(5));
    }
    if (PRECISION_6DECIMALS.has(property)) {
        return Math.round(value * 1e6) / 1e6;
    }
    return Math.round(value * 1e3) / 1e3; // Class D default: 3 decimals.
}

/**
 * Round every own numeric property of an RTCStats object in place.
 * Nested objects (e.g. map-valued members like qualityLimitationDurations)
 * are left untouched.
 * @param {object} rtcStats - a single stats object.
 *
 * @returns {object} the same object, mutated in place.
 */
export function truncateStatsReport(rtcStats) {
    for (const property of Object.keys(rtcStats)) {
        rtcStats[property] = truncateStatsValue(property, rtcStats[property]);
    }
    return rtcStats;
}
