import fsPromises from 'node:fs/promises';

import config from 'config';

import {readRTCStatsDump, extractTracks} from '@rtcstats/rtcstats-shared';
import {createStorage} from '@rtcstats/rtcstats-server/storage/index.js';
import {createDatabase} from '@rtcstats/rtcstats-server/database/index.js';

import {extractClientFeatures, extractConnectionFeatures, extractTrackFeatures} from './features.js';

const storage = createStorage(config.storage);
const database = createDatabase(config.database);
const {sql} = database;

async function extract(id, dump) {
    let result;

    // Metadata is gathered on the server-side.
    const metadata = Object.keys(dump).reduce((result, key) => {
        if (!['peerConnections', 'eventSizes'].includes(key)) {
            result[key] = dump[key];
        }
        return result;
    }, {});
    if (!metadata.origin) {
        // Weird dumps from an old extension version.
        console.log('Dump without origin, metadata is', metadata);
        return;
    }
    result = await sql`insert into ${sql('features_metadata')}
        (dump_id,
         start_time,
         number_peerconnections,
         url, origin, useragent,
         client_protocol, file_format
        )
        values
        (${id},
         ${metadata.startTime},
         ${Object.keys(dump.peerConnections).length - 1},
         ${metadata.url}, ${metadata.origin}, ${metadata.userAgent},
         ${metadata.clientProtocol}, ${metadata.fileFormat}
        ) returning id`;
    const dumpId = result[0].id;

    // Client information is gathered on the client.
    const clientTrace = dump.peerConnections['null'];
    const clientFeatures = extractClientFeatures(clientTrace);
    await sql`insert into ${sql('features_client')}
        (dump_id,
         start_time, duration,
         user_agent_data,
         hardware_concurrency, device_memory,
         screen, ${sql('window')},
         called_getusermedia, called_getusermedia_audio, called_getusermedia_combined, called_getusermedia_video,
         called_getdisplaymedia, called_getdisplaymedia_audio, called_getdisplaymedia_video,
         getusermedia_success_count, getusermedia_error_count,
         getdisplaymedia_success_count, getdisplaymedia_error_count,
         getusermedia_error,
         enumerate_devices_count
        )
        values
        (${dumpId},
         ${clientFeatures.startTime}, ${clientFeatures.duration},
         ${clientFeatures.userAgentData},
         ${clientFeatures.hardwareConcurrency}, ${clientFeatures.deviceMemory},
         ${clientFeatures.screen}, ${clientFeatures.window},
         ${clientFeatures.calledGetUserMedia}, ${clientFeatures.calledGetUserMediaAudio}, ${clientFeatures.calledGetUserMediaCombined}, ${clientFeatures.calledGetUserMediaVideo},
         ${clientFeatures.calledGetDisplayMedia}, ${clientFeatures.calledGetDisplayMediaAudio}, ${clientFeatures.calledGetDisplayMediaVideo},
         ${clientFeatures.getUserMediaSuccessCount}, ${clientFeatures.getUserMediaErrorCount},
         ${clientFeatures.getDisplayMediaSuccessCount}, ${clientFeatures.getDisplayMediaErrorCount},
         ${clientFeatures.getUserMediaError},
         ${clientFeatures.enumerateDevicesCount}
        )`;

    // Extract connection features, ignoring the `null` connection which provides client information.
    for (const peerConnectionId of Object.keys(dump.peerConnections)) {
        if (peerConnectionId === 'null') {
            continue;
        }
        const peerConnectionTrace = dump.peerConnections[peerConnectionId];
        const connectionFeatures = extractConnectionFeatures(clientTrace, peerConnectionTrace);
        result = await sql`insert into ${sql('features_connection')}
            (dump_id,
             connection_identifier, start_time, duration,
             number_of_events, number_of_events_not_getstats,
             closed,
             ice_connected, using_ice_lite,
             ice_connection_time, ice_restart,
             add_ice_candidate_failure, set_local_description_failure, set_remote_description_failure,
             connected, connection_time,
             dtls_version, dtls_role
            )
            values
            (${dumpId},
             ${peerConnectionId}, ${connectionFeatures.startTime}, ${connectionFeatures.duration},
             ${connectionFeatures.numberOfEvents}, ${connectionFeatures.numberOfEventsNotGetStats},
             ${connectionFeatures.closed},
             ${connectionFeatures.iceConnected}, ${connectionFeatures.usingIceLite},
             ${connectionFeatures.iceConnectionTime}, ${connectionFeatures.iceRestart},
             ${connectionFeatures.addIceCandidateFailure}, ${connectionFeatures.setLocalDescriptionFailure}, ${connectionFeatures.setRemoteDescriptionFailure},
             ${connectionFeatures.connected}, ${connectionFeatures.connectionTime},
             ${connectionFeatures.dtlsVersion}, ${connectionFeatures.dtlsRole}
            ) returning id`;
        const connectionId = result[0].id;

        // Extract track features. Each connection can have multiple tracks.
        const tracks = await extractTracks(peerConnectionTrace);
        for (const trackInformation of tracks) {
            const trackFeatures = extractTrackFeatures(clientTrace, peerConnectionTrace, trackInformation);
            await sql`insert into ${sql('features_track')}
                (connection_id,
                 track_identifier, start_time, duration,
                 kind, direction
                )
                values
                (${connectionId},
                 ${trackFeatures.trackId}, ${trackFeatures.startTime}, ${trackFeatures.duration},
                 ${trackFeatures.kind}, ${trackFeatures.direction}
                )`;
        }
        // TODO: do we want datachannel features?
    }
    // Note: the query below will be empty if the dump had no peerconnections.
    result = await sql`select * from "rtcstats-server" as server
        join features_metadata on features_metadata.dump_id = server.id
        join features_client on features_client.dump_id = features_metadata.id
        join features_connection on features_connection.dump_id = features_metadata.id
        join features_track on features_track.connection_id = features_connection.id
        where server.id = ${id}`;
    for (const row of result) {
        // console.log('ROW', row);
    }
}

async function fetch() {
    return {
        id: result[0].id,
        url: result[0].blob_url,
        responseStream: storage.get(filename)
    };
}

async function process() {
    while (true) {
        const result = await sql`update ${sql(config.database.postgres.tableName)}
            set features_processing_start = now()
            where CTID IN (select CTID from ${sql(config.database.postgres.tableName)}
                where features_processing_start is null order by created_at asc limit 1)
            returning id, blob_url`;
        if (!result.length) {
            break;
        }
        const url = result[0].blob_url;
        const filename = url.split('/').slice(3)[0];
        console.log('processing', url);
        const blob = await new Response(await storage.get(filename)).blob();
        const dump = await readRTCStatsDump(blob);
        if (!dump) {
            console.error('Failed to read RTCStats dump from stream', result[0].blob_url);
            continue;
        }
        await extract(result[0].id, dump);
        await sql`update ${sql(config.database.postgres.tableName)}
            set features_processing_stop = now()
            where id = ${result[0].id}`;
    }
}

process()
    .then(() => {
        return sql.close();
    })
    .catch(err => {
        console.error('An error occurred during processing:', err);
        return sql.close();
    });
