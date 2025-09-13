import fs from 'node:fs';
import postgres from 'postgres';

// TODO: add table and database migrations.
export function createPostgres(config) {
    // TODO: add pool size from config.
    const sql = postgres(config.connectionString, {
        ssl: {
            ca: fs.readFileSync(config.ssl.capath).toString(),
            sslmode: config.ssl.mode
        },
    });
    return {
        dump: (name, startTime, stopTime, blobUrl, metadata) => {
            const startDate = new Date(startTime);
            const stopDate = new Date(stopTime);
            let userId = null;
            let conferenceId = null;
            if (metadata && metadata.authData && metadata.authData.rtcStats) {
                userId = metadata.authData.rtcStats.user;
                conferenceId = metadata.authData.rtcStats.conference;
            }
            return sql`insert into ${sql(config.tableName)}
                    (session_start, session_end, blob_url, metadata, rtcstats_user, rtcstats_conference)
                    values
                    (${startDate.toISOString()}, ${stopDate.toISOString()},
                     ${blobUrl}, ${metadata}, ${userId}, ${conferenceId})
                    returning id`;
        },
        fetchUnprocessedDump: () => {
            return sql`select blob_url from ${sql(config.tableName)}
                    where features_url is null
                    order by created_at desc
                    limit 1`
                .then(result => {
                    if (!result.length) return undefined;
                    return result[0].blob_url.split('/').slice(3)[0];
                });
        },
    };
}
