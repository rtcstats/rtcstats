import fs from 'node:fs';
import postgres from 'postgres';

export function createPostgres(config) {
    // TODO: add pool size from config.
    const sql = postgres(config.connectionString, {
        ssl: {
            ca: fs.readFileSync(config.ssl.capath).toString(),
            sslmode: config.ssl.mode
        },
        transform: {
            undefined: null,
            column: {
                to: postgres.fromCamel
            },
        },
    });
    return {
        sql, // raw SQL access.
        insert: async (startTime, authData) => {
            const startDate = new Date(startTime);

            // Extract authentication data.
            let userId;
            let conferenceId;
            let sessionId;
            if (authData && authData.rtcStats) {
                userId = authData.rtcStats.user;
                conferenceId = authData.rtcStats.conference;
                sessionId = authData.rtcStats.session;
            }
            const result = await sql`insert into ${sql(config.tableName)}
                    (session_start,
                     rtcstats_user, rtcstats_conference, rtcstats_session)
                    values
                    (${startDate.toISOString()},
                     ${userId || null}, ${conferenceId || null}, ${sessionId || null}
                    )
                    returning id`;
            return result[0].id;
        },
        update: (id, stopTime, blobUrl) => {
            const stopDate = new Date(stopTime);

            return sql`update ${sql(config.tableName)}
                    set session_end = ${stopDate.toISOString()},
                        blob_url = ${blobUrl}
                    where id = ${id}`;
        },
        setRtcStatsEmbedUrl: (id, rtcStatsEmbedUrl) => {
            return sql`update ${sql(config.tableName)}
                    set rtcstats_embed_url = ${rtcStatsEmbedUrl}
                    where id = ${id}`;
        },
        close: () => {
            return sql.close();
        },
    };
}
