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
        dump: (name, startTime, stopTime, blobUrl, metadata) => {
            const startDate = new Date(startTime);
            const stopDate = new Date(stopTime);

            // Extract authentication data.
            let userId;
            let conferenceId;
            let sessionId;
            if (metadata && metadata.authData && metadata.authData.rtcStats) {
                userId = metadata.authData.rtcStats.user;
                conferenceId = metadata.authData.rtcStats.conference;
                sessionId = metadata.authData.rtcStats.session;
            }
            return sql`insert into ${sql(config.tableName)}
                    (session_start, session_end, blob_url,
                     rtcstats_user, rtcstats_conference, rtcstats_session)
                    values
                    (${startDate.toISOString()}, ${stopDate.toISOString()},
                     ${blobUrl},
                     ${userId || null}, ${conferenceId || null}, ${sessionId || null}
                    )`;
        },
        close: () => {
            return sql.close();
        },
    };
}
