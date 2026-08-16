-- On a database with existing rows, run the statement below by hand with
-- CONCURRENTLY added after CREATE INDEX, then apply this migration, which
-- no-ops. A plain CREATE INDEX takes a SHARE lock and blocks inserts for the
-- length of the build. See the pull request that added this migration.
create index if not exists "rtcstats-server_pending_features_idx"
    on "public"."rtcstats-server" ("created_at")
    where blob_url is not null and features_processing_start is null;
