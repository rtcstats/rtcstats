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
        insert: async (startTime, authData, hostIdentifier) => {
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
                     rtcstats_user, rtcstats_conference, rtcstats_session,
                     host_identifier)
                    values
                    (${startDate.toISOString()},
                     ${userId || null}, ${conferenceId || null}, ${sessionId || null},
                     ${hostIdentifier || null}
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
        insertRtcStatsAnalysis: async (dumpId, response) => {
            const data = response.data || {};
            const row = {
                dumpId,
                rtcstatsId: response.rtcstatsId || data.id || null,
                schemaVersion: data.schemaVersion || null,
                analysisVersion: data.analysisVersion || null,
                observationsVersion: data.observationsVersion || null,
                uploadTimestamp: data.uploadTimestamp || null,
                experienceScore: data.experienceScore ?? null,
                audioScore: data.audioScore ?? null,
                videoScore: data.videoScore ?? null,
                connectivityScore: data.connectivityScore ?? null,
                observationsScore: data.observationsScore ?? null,
                observationsCount: data.observationsCount || null,
                aiSummary: data.aiSummary || null,
                userAgentData: data.userAgentData || null,
            };
            const result = await sql`insert into ${sql('rtcstats_analysis')} ${sql(row)} returning id`;
            const analysisId = result[0].id;
            const observationRows = (data.observations || []).map((observation) => ({
                analysisId,
                pid: (observation.source && observation.source.pid) || null,
                type: observation.type,
                severity: observation.severity,
                category: observation.category,
                firstSeenAt: observation.firstSeenAt,
                observation,
            }));
            if (observationRows.length) {
                await sql`insert into ${sql('rtcstats_observations')} ${sql(observationRows)}`;
            }
        },
    };
}
