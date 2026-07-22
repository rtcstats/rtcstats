create index "features_metadata_dump_id_idx" on "public"."features_metadata" ("dump_id");

create index "features_client_dump_id_idx" on "public"."features_client" ("dump_id");

create index "features_connection_dump_id_idx" on "public"."features_connection" ("dump_id");

create index "features_track_connection_id_idx" on "public"."features_track" ("connection_id");
