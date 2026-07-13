// CLI that runs the rtcstats feature extractors over a single dump file and prints
// the extracted features as JSON. Usage:
//
//     node bin/features.js <dump-file>
//
// The output is a single JSON object shaped as:
//
//     {
//       ...clientFeatures,          // client features spread at the top level
//       peerConnections: [
//         {
//           ...connectionFeatures,   // connection features spread inline
//           tracks: [ { ...trackFeatures }, ... ]
//         },
//         ...
//       ]
//     }
//
// This mirrors the client -> connection -> track hierarchy of a dump. For a
// description of every field in each of the three feature groups, see
// ../packages/rtcstats-features/features.md.
import fsPromises from 'node:fs/promises';

import {extractTracks, readDump} from '@rtcstats/rtcstats-shared';
import {extractClientFeatures, extractConnectionFeatures, extractTrackFeatures} from '../packages/rtcstats-features/features.js';

function cleanFeatures(features) {
    Object.keys(features).forEach(name => {
        if (features[name] === undefined) delete features[name];
    });
    return features;
}

async function extract(dump) {
    // Client information lives on the synthetic `null` peer connection (events not
    // scoped to a real RTCPeerConnection: getUserMedia, enumerateDevices, ...).
    // See "Client features" in features.md.
    const clientTrace = dump.peerConnections['null'];
    // Client features live at the top level alongside `peerConnections`; no client
    // feature is named `peerConnections`, so there is no collision.
    const result = {
        ...cleanFeatures(extractClientFeatures(clientTrace)),
        peerConnections: [],
    };

    // One entry per real RTCPeerConnection, skipping the `null` client connection above.
    // See "Connection features" in features.md.
    for (const peerConnectionId of Object.keys(dump.peerConnections)) {
        if (peerConnectionId === 'null') {
            continue;
        }
        const peerConnectionTrace = dump.peerConnections[peerConnectionId];
        // Connection features spread inline alongside `tracks`; no connection feature
        // is named `tracks`, so there is no collision.
        const connection = {
            ...cleanFeatures(extractConnectionFeatures(clientTrace, peerConnectionTrace)),
            tracks: [],
        };

        // One entry per inbound/outbound media track on this connection. Each track
        // carries its own `trackIdentifier`. See "Track features" in features.md.
        const tracks = await extractTracks(peerConnectionTrace);
        for (const trackInformation of tracks) {
            connection.tracks.push(
                cleanFeatures(extractTrackFeatures(clientTrace, peerConnectionTrace, trackInformation)));
        }
        result.peerConnections.push(connection);
    }

    console.log(JSON.stringify(result, null, 2));
}

fsPromises.readFile(process.argv[2])
    .then(data => new Blob([data]))
    .then(readDump)
    .then(extract);
