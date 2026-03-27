ALTER TABLE "public"."features_connection" ADD COLUMN gathered_host BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN gathered_mdns BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN gathered_srflx BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN gathered_turn BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN added_host BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN added_mdns BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN added_srflx BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN added_turn BOOLEAN;