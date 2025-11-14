ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_servers INTEGER;
ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_transport_policy BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_servers_stun BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_servers_turns BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_servers_turn_udp BOOLEAN;
ALTER TABLE "public"."features_connection" ADD COLUMN configured_ice_servers_turn_tcp BOOLEAN;