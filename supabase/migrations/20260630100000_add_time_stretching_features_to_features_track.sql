ALTER TABLE "public"."features_track" ADD COLUMN inserted_samples_for_deceleration INTEGER;
ALTER TABLE "public"."features_track" ADD COLUMN removed_samples_for_acceleration INTEGER;
ALTER TABLE "public"."features_track" ADD COLUMN deceleration_percentage FLOAT;
ALTER TABLE "public"."features_track" ADD COLUMN acceleration_percentage FLOAT;
