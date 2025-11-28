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
        if (!['peerConnections', 'eventSizes', 'locations'].includes(key)) {
            result[key] = dump[key];
        }
        return result;
    }, {});
    if (!metadata.origin) {
        // Weird dumps from an old extension version.
        console.log('Dump without origin, metadata is', metadata);
        return;
    }
    const {locations} = dump;
    if (locations && locations[0]) {
        metadata.locationCountry = locations[0].country.iso_code;
    }
    const metadataToInsert = {
        dumpId: id,
        numberPeerconnections: Object.keys(dump.peerConnections).length - 1,
        startTime: metadata.startTime,
        url: metadata.url,
        origin: metadata.origin,
        useragent: metadata.userAgent,
        clientProtocol: metadata.clientProtocol,
        fileFormat: metadata.fileFormat,
        locationCountry: metadata.locationCountry
    };
    result = await sql`insert into ${sql('features_metadata')} ${sql(metadataToInsert)} returning id`;
    const dumpId = result[0].id;

    // Client information is gathered on the client.
    const clientTrace = dump.peerConnections['null'];
    const clientFeatures = extractClientFeatures(clientTrace);
    const clientData = {
        dumpId,
        ...clientFeatures
    };
    await sql`insert into ${sql('features_client')} ${sql(clientData)}`;

    // Extract connection features, ignoring the `null` connection which provides client information.
    for (const peerConnectionId of Object.keys(dump.peerConnections)) {
        if (peerConnectionId === 'null') {
            continue;
        }
        const peerConnectionTrace = dump.peerConnections[peerConnectionId];
        const connectionFeatures = extractConnectionFeatures(clientTrace, peerConnectionTrace);
        const connectionData = {
            dumpId,
            connectionIdentifier: peerConnectionId,
            ...connectionFeatures
        };
        result = await sql`insert into ${sql('features_connection')} ${sql(connectionData)} returning id`;
        const connectionId = result[0].id;

        // Extract track features. Each connection can have multiple tracks.
        const tracks = await extractTracks(peerConnectionTrace);
        for (const trackInformation of tracks) {
            const trackFeatures = extractTrackFeatures(clientTrace, peerConnectionTrace, trackInformation);
            const trackData = {
                connectionId,
                ...trackFeatures
            };
            await sql`insert into ${sql('features_track')} ${sql(trackData)}`;
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
