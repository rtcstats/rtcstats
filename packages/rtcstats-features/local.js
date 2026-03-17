import fsPromises from 'node:fs/promises';

import {readRTCStatsDump, extractTracks} from '@rtcstats/rtcstats-shared';
import {extractClientFeatures, extractConnectionFeatures, extractTrackFeatures} from './features.js';

function cleanFeatures(features) {
    Object.keys(features).forEach(name => {
        if (features[name] === undefined) delete features[name];
    });
    return features;
}
async function extract(dump) {
    // Client information is gathered on the client.
    const clientTrace = dump.peerConnections['null'];
    const clientFeatures = extractClientFeatures(clientTrace);
    console.log(cleanFeatures(clientFeatures));

    // Extract connection features, ignoring the `null` connection which provides client information.
    for (const peerConnectionId of Object.keys(dump.peerConnections)) {
        if (peerConnectionId === 'null') {
            continue;
        }
        const peerConnectionTrace = dump.peerConnections[peerConnectionId];
        const connectionFeatures = extractConnectionFeatures(clientTrace, peerConnectionTrace);
        console.log(cleanFeatures(connectionFeatures));

        // Extract track features. Each connection can have multiple tracks.
        const tracks = await extractTracks(peerConnectionTrace);
        for (const trackInformation of tracks) {
            const trackFeatures = extractTrackFeatures(clientTrace, peerConnectionTrace, trackInformation);
            console.log(cleanFeatures(trackFeatures));
        }
    }
}

fsPromises.readFile(process.argv[2])
    .then(data => new Blob([data]))
    .then(readRTCStatsDump)
    .then(extract);
