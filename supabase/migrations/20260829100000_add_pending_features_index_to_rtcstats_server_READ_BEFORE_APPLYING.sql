-- On a database with existing rows, run the statement below by hand with
-- CONCURRENTLY added after CREATE INDEX, then apply this migration, which
-- no-ops. A plain CREATE INDEX takes a SHARE lock that blocks inserts until
-- the index has been added. The guard below refuses to do that; drop it if
-- you want the lock. See the pull request that added this migration.
do $$
begin
    if to_regclass('public."rtcstats-server_pending_features_idx"') is null
        and (select reltuples from pg_class where oid = 'public."rtcstats-server"'::regclass) > 10000
    then
        raise exception 'create this index concurrently by hand first, see the comment in this file';
    end if;
end $$;
create index if not exists "rtcstats-server_pending_features_idx"
    on "public"."rtcstats-server" ("created_at")
    where blob_url is not null and features_processing_start is null;
