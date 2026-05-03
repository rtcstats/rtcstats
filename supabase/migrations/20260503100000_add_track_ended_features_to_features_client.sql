ALTER TABLE "public"."features_client" ADD COLUMN audio_ended BOOLEAN DEFAULT FALSE;
ALTER TABLE "public"."features_client" ADD COLUMN audio_short_duration BOOLEAN DEFAULT FALSE;
ALTER TABLE "public"."features_client" ADD COLUMN video_ended BOOLEAN DEFAULT FALSE;
ALTER TABLE "public"."features_client" ADD COLUMN video_short_duration BOOLEAN DEFAULT FALSE;
