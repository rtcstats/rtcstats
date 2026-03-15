ALTER TABLE "public"."features_track" ADD COLUMN qp_sum INTEGER;
ALTER TABLE "public"."features_track" ADD COLUMN psnr_measurements INTEGER;
ALTER TABLE "public"."features_track" ADD COLUMN psnr_sum_y FLOAT;
ALTER TABLE "public"."features_track" ADD COLUMN psnr_sum_u FLOAT;
ALTER TABLE "public"."features_track" ADD COLUMN psnr_sum_v FLOAT;
