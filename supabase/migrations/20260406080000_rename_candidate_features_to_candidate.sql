ALTER TABLE "public"."features_connection" RENAME COLUMN gathered_host TO gathered_host_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN gathered_mdns TO gathered_mdns_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN gathered_srflx TO gathered_srflx_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN gathered_turn TO gathered_turn_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN added_host TO added_host_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN added_mdns TO added_mdns_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN added_srflx TO added_srflx_candidate;
ALTER TABLE "public"."features_connection" RENAME COLUMN added_turn TO added_turn_candidate;
