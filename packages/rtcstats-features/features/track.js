/* eslint sort-keys: "error" */
import SDPUtils from 'sdp';

import {parseTrackWithStreams} from '@rtcstats/rtcstats-shared';

function pluckStat(statsObject, properties) {
    if (!statsObject) return;
    for (const property of properties) {
        if (statsObject.hasOwnProperty(property)) {
            return statsObject[property];
        }
    }
}

function divideStat(statsObject, nominator, denominator) {
    if (!statsObject) return;
    if (!(statsObject.hasOwnProperty(nominator) && statsObject.hasOwnProperty(denominator))) {
        return undefined;
    }
    return statsObject[nominator] / statsObject[denominator];
}

function codecFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
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
}

function resolutionFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
    if (trackInformation.kind === 'audio') return {};
    const widths = {};
    const heights = {};
    for (const traceEvent of peerConnectionTrace) {
        if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
        const report = traceEvent.value;
        if (!report[trackInformation.statsId]) continue;
        const {frameWidth, frameHeight} = report[trackInformation.statsId];
        if (!(frameWidth && frameHeight)) continue;
        if (!widths[frameWidth]) widths[frameWidth] = 0;
        widths[frameWidth]++;
        if (!heights[frameHeight]) heights[frameHeight] = 0;
        heights[frameHeight]++;
    }
    if (Object.keys(widths).length === 0 || Object.keys(heights).length === 0) {
        return {};
    }
    const mostCommon = (data) => {
        const values = Object.values(data);
        const maxValue = Math.max.apply(null, values);
        return parseInt(Object.keys(data)[values.indexOf(maxValue)], 10);
    };
    return {
        commonHeight: mostCommon(heights),
        commonWidth: mostCommon(widths),
        maxHeight: Math.max.apply(null, Object.keys(heights).map(h => parseInt(h, 10))),
        maxWidth: Math.max.apply(null, Object.keys(widths).map(w => parseInt(w, 10))),
        minHeight: Math.min.apply(null, Object.keys(heights).map(h => parseInt(h, 10))),
        minWidth: Math.min.apply(null, Object.keys(widths).map(w => parseInt(w, 10))),
    };
}

function lastStatsFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
    const features = {
        duration: 0,
    };
    let lastStatsEvent;
    let lastTrackStats;
    for (let i = peerConnectionTrace.length - 1; i >= 0; i--) {
        const traceEvent = peerConnectionTrace[i];
        if (traceEvent.type !== 'getStats' || !traceEvent.value) continue;
        if (!traceEvent.value[trackInformation.statsId]) continue;
        lastStatsEvent = traceEvent;
        lastTrackStats = traceEvent.value[trackInformation.statsId];
        break;
    }
    if (!lastStatsEvent) {
        return features;
    }
    // Inbound and outbound.
    features['duration'] = Math.floor(lastStatsEvent.timestamp - trackInformation.startTime);
    features['frameCount'] = pluckStat(lastTrackStats, ['framesEncoded', 'framesDecoded']);
    features['keyFrameCount'] = pluckStat(lastTrackStats, ['keyFramesEncoded', 'keyFramesDecoded']);
    features['qpSum'] = pluckStat(lastTrackStats, ['qpSum']);
    features['nackCount'] = pluckStat(lastTrackStats, ['nackCount']);
    features['pliCount'] = pluckStat(lastTrackStats, ['pliCount']);
    features['firCount'] = pluckStat(lastTrackStats, ['firCount']);

    if (trackInformation.direction === 'outbound') {
        // Outbound.
        const qualityLimitationDurations = pluckStat(lastTrackStats, ['qualityLimitationDurations']);
        if (qualityLimitationDurations) {
            const totalDuration = Object.keys(qualityLimitationDurations)
                .map(k => qualityLimitationDurations[k])
                .reduce((a, b) => a + b, 0);
            features['bandwidthQualityLimitationPercentage'] = qualityLimitationDurations['bandwidth'] / totalDuration;
            features['cpuQualityLimitationPercentage'] = qualityLimitationDurations['cpu'] / totalDuration;
            features['otherQualityLimitationPercentage'] = qualityLimitationDurations['other'] / totalDuration;
        }
        features['qualityLimitationResolutionChanges'] = pluckStat(lastTrackStats, ['qualityLimitationResolutionChanges']);
        features['averageEncodeTime'] = pluckStat(lastTrackStats, ['totalEncodeTime']) / pluckStat(lastTrackStats, ['framesEncoded']);
        features['rid'] = pluckStat(lastTrackStats, ['rid']); // rid is important to group by simulcast layer.
        features['encodingIndex'] = pluckStat(lastTrackStats, ['encodingIndex']); // encodingIndex is important to group by simulcast layer.
        if (pluckStat(lastTrackStats, ['psnrMeasurements'])) {
            features['psnrMeasurements'] = pluckStat(lastTrackStats, ['psnrMeasurements']);
            const psnrSum = pluckStat(lastTrackStats, ['psnrSum']);
            features['psnrSumY'] = psnrSum['y'];
            features['psnrSumU'] = psnrSum['u'];
            features['psnrSumV'] = psnrSum['v'];
        }
        // HW acceleration
        features['encoderImplementation'] = pluckStat(lastTrackStats, ['encoderImplementation']);
        features['powerEfficientEncoder'] = pluckStat(lastTrackStats, ['powerEfficientEncoder']);
    } else {
        // Inbound.
        features['freezeCount'] = pluckStat(lastTrackStats, ['freezeCount']);
        features['totalFreezesDuration'] = pluckStat(lastTrackStats, ['totalFreezesDuration']);
        features['framesDropped'] = pluckStat(lastTrackStats, ['framesDropped']);
        // HW acceleration
        features['decoderImplementation'] = pluckStat(lastTrackStats, ['decoderImplementation']);
        features['powerEfficientDecoder'] = pluckStat(lastTrackStats, ['powerEfficientDecoder']);

        // Jitter buffer.
        features['jitterBufferDelay'] = pluckStat(lastTrackStats, ['jitterBufferDelay']);
        features['jitterBufferMinimumDelay'] = pluckStat(lastTrackStats, ['jitterBufferMinimumDelay']);
        features['jitterBufferTargetDelay'] = pluckStat(lastTrackStats, ['jitterBufferTargetDelay']);
        features['jitterBufferEmittedCount'] = pluckStat(lastTrackStats, ['jitterBufferEmittedCount']);
        features['totalProcessingDelay'] = pluckStat(lastTrackStats, ['totalProcessingDelay']);

        features['framesAssembledFromMultiplePackets'] = pluckStat(lastTrackStats, ['framesAssembledFromMultiplePackets']);
        features['totalAssemblyTime'] = pluckStat(lastTrackStats, ['totalAssemblyTime']);

        // Averages.
        features['averageDecodeTime'] = divideStat(lastTrackStats, 'totalDecodeTime', 'framesDecoded');
        features['averageJitterBufferDelay'] = divideStat(lastTrackStats, 'jitterBufferDelay', 'jitterBufferEmittedCount');
        features['averageProcessingDelay'] = divideStat(lastTrackStats, 'totalProcessingDelay', 'jitterBufferEmittedCount');
        features['averageAssemblyTime'] = divideStat(lastTrackStats, 'totalAssemblyTime', 'framesAssembledFromMultiplePackets');
    }
    return features;
}

export function extractTrackFeatures(/* clientTrace*/_, peerConnectionTrace, trackInformation) {
    // Track stats can be extracted by iterating over peerConnectionTrace and looking at
    // getStats events which are associated with trackInformation.statsId.
    const features = {
        direction: trackInformation.direction,
        kind: trackInformation.kind,
        startTime: trackInformation.startTime,
        trackIdentifier: trackInformation.id,
    };

    return {
        ...codecFeatures(undefined, peerConnectionTrace, trackInformation),
        ...features,
        ...resolutionFeatures(undefined, peerConnectionTrace, trackInformation),
        ...lastStatsFeatures(undefined, peerConnectionTrace, trackInformation),
    };
}
