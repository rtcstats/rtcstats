ALTER TABLE "public"."features_connection" ADD COLUMN ice_connection_time INTEGER;
ALTER TABLE "public"."features_connection" ADD COLUMN ice_restart BOOLEAN DEFAULT FALSE;
