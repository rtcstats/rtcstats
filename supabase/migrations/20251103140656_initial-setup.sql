drop extension if exists "pg_net";


  create table "public"."rtcstats-server" (
    "created_at" timestamp with time zone not null default now(),
    "session_start" timestamp with time zone,
    "session_end" timestamp with time zone,
    "blob_url" text,
    "features_url" text,
    "metadata" jsonb,
    "id" uuid not null default gen_random_uuid(),
    "rtcstats_user" text,
    "rtcstats_conference" text,
    "rtcstats_session" text
      );


alter table "public"."rtcstats-server" enable row level security;

grant delete on table "public"."rtcstats-server" to "anon";

grant insert on table "public"."rtcstats-server" to "anon";

grant references on table "public"."rtcstats-server" to "anon";

grant select on table "public"."rtcstats-server" to "anon";

grant trigger on table "public"."rtcstats-server" to "anon";

grant truncate on table "public"."rtcstats-server" to "anon";

grant update on table "public"."rtcstats-server" to "anon";

grant delete on table "public"."rtcstats-server" to "authenticated";

grant insert on table "public"."rtcstats-server" to "authenticated";

grant references on table "public"."rtcstats-server" to "authenticated";

grant select on table "public"."rtcstats-server" to "authenticated";

grant trigger on table "public"."rtcstats-server" to "authenticated";

grant truncate on table "public"."rtcstats-server" to "authenticated";

grant update on table "public"."rtcstats-server" to "authenticated";

grant delete on table "public"."rtcstats-server" to "service_role";

grant insert on table "public"."rtcstats-server" to "service_role";

grant references on table "public"."rtcstats-server" to "service_role";

grant select on table "public"."rtcstats-server" to "service_role";

grant trigger on table "public"."rtcstats-server" to "service_role";

grant truncate on table "public"."rtcstats-server" to "service_role";

grant update on table "public"."rtcstats-server" to "service_role";


