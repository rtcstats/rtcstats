ALTER TABLE "public"."features_connection" ADD COLUMN ice_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE "public"."features_connection" ADD COLUMN using_ice_lite BOOLEAN DEFAULT FALSE;
