This is part of the [monorepo](https://github.com/rtcstats/rtcstats) for rtcstats-js
(clientside monitoring), rtcstats-server (serverside dump collection) and the updated
dump-importer (supporting rtcstats and webrtc-internals formats).

It is part of a bigger offering that includes [rtcstats.com](https://rtcstats.com),
an online service for debugging and troubleshooting WebRTC statistics.

# rtcstats-server
The server listens on a WebSocket and writes the incoming data (the "dump") to a temporary file.
If configured, the dump file is uploaded to storage (S3 or compatible) and metadata is
written to a database (postgres or compatible). See [below](#rtcstats-dump-file-format) for
a formal specification of the dump file format.

Compared to previous iterations of rtcstats-server, feature extraction is currently not supported.

# Starting the server
```
npm start
```
will start the server, using the default configuration in `config/default.yaml`.
The server will listen for websockets on the default port 8080.

This configuration typically needs to be adjusted to specify the
* the authorization jwtSecret which typically needs to be shared with the application or
  signaling server generating the JWT as described below.
* the S3 confiugration for storing the files. If not configured the files will only be
  stored locally and removed on the next restart.
* the Postgres database configuration for storing metadata such as the S3 storage configuration.

## Usage with Docker
See the Dockerfile in the toplevel directory.

For configuring rtcstats-server within Docker it is recommended to use
the `NODE_CONFIG` environment variable as described in the
[config package documentation](https://github.com/node-config/node-config/wiki/Environment-Variables#node_config).

## Testing
Running
```
npm test
```
will run linting and unit/e2e tests for rtcstats-server.

# JWT-based authorization
By default, rtcstats-server will accept any websocket connection.

It is preferable to authorize such connections using [JSON Web Token](https://en.wikipedia.org/wiki/JSON_Web_Token).
This also allows secure identification of users, conferences and sessions.

rtcstats-js supports adding JWT tokens to the WebSocket URL as part of the query string, i.e.
```
trace.connect('wss://example.com?rtcstats-token=...
```
When configured with `authorization.jwtSecret`, rtcstats-server will validate the token.
If the token is not valid, the WebSocket connection will be closed with a `policy-violation`
(code 1008) error.
If the token is valid, RTCStats-server will extract the `rtcstats` object and export the
following fields to the database:
* user: a long-lived service-defined identifer for the user
* session: a short-lived service-defined identiﬁier for the user session.
* conference: a service-defined identifier for a conference or call. This can be used to search and groups dumps with multiple users.

See the [example](/example/) for how such a integration looks like.

# RTCStats dump file format

RTCStats dump files are line-oriented JSON as described in [JSON Lines](https://jsonlines.org/).

This section described the file format in **version 3**. See below for older file formats and upgrading
Breaking changes to the file format require an upgrade plan.

RTCStats dump files may be compressed using standard compression methods such as gzip, bzip or brotli.
* WebRTC domain specific compression such as method compression or stats property compression MUST be supported by importers and MAY be used by clients.
* getStats delta compression MUST be supported by importers and MAY be used by clients.

The first line of every file is `RTCStatsDump` followed by a new line and a JSON object with metadata.
*  At minimum that object must include a `fileFormat` property with an integer value specifying the file format version.

Every line after this is a JSON array with RTCStats events.
* Usually four elements but some methods have additional elements.
* First element is the method or event name, e.g. `setLocalDescription` or `ontrack`.
  * This SHOULD be compressed using a static table during transfer and MAY be compressed in storage.
  * For promise resolutions or callbacks this should have either a `OnSuccess` or `OnFailure` suffix.
* Second element is the peerconnection id or `null` if this is not related to a peerconnection.
  * E.g. `getUserMedia`-related events are not associated with a peerconnection so
  * Peerconnection ids should be unique per dump but are not required to be unique across dumps.
* Third element is the arguments to the call or the event.
  * The value type and format depend on the method name.
  * For most events it is either an array with the arguments to the API call serialized as an array. If the method has only a single argument this will be used as-is
* There may be additional elements:
  * E.g. a correlation id to associate a call to `setLocalDescription` with a call to its corresponding `setLocalDescriptionOnSuccess`.
  * For events related to `RTCRtpTransceiver` or `RTCRtpSender`, e.g. `getParameters()` this is an object identifier.
* The last element is the timestamp delta in milliseconds at which the event was generated by the client, relative to the last event.
  * The first delta is relative to the UNIX epoch and is the actual timestamp.
  * Float values may be used when microsecond precision is required.
* Personally identifiable information SHOULD be obfuscated.
  * IP addresses on SDP, `onicecandidate`, `addIceCandidate` or `RTCStatsReport`.
  * Device labels from `enumerateDevices` or `getUserMediaOnSuccess`.
  * Servers SHOULD do obfuscation, clients MAY.

## Old versions
Versions 1 and 2 were used by the legacy RTCStats server. They are not supported.

# Database Migrations
Database migrations are handled using [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations).
The migration files are located in `packages/rtcstats-server/supabase/migrations`.

The initial table schema is defined in `20251103140656_initial-setup.sql` and looks like this:
```sql
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
```
Database migrations can be deployed using `supabase db push`.

Note: while using supabase, the migrations are plain SQL and can be applied without relying on supabase.
