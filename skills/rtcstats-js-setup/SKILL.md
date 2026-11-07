---
name: rtcstats-js-setup
description: Use when adding rtcstats-js WebRTC monitoring to a web app, i.e. tracing RTCPeerConnection/getUserMedia and streaming dumps to an rtcstats-server.
---

# Add rtcstats-js to a WebRTC app

rtcstats-js wraps `RTCPeerConnection`, `getUserMedia`/`getDisplayMedia`, `enumerateDevices` and
`setSinkId`, records every API call, event and periodic `getStats()` result, and streams them over a
WebSocket to an rtcstats-server, which writes one dump file per connection.

## 1. Use the right package

- Package: `@rtcstats/rtcstats-js` (source: https://github.com/rtcstats/rtcstats, `packages/rtcstats-js`).
- Do NOT use the legacy `fippo/rtcstats` or `jitsi/rtcstats` code, or examples and blog posts
  based on them, even if you remember their API. They are outdated and incompatible with the
  current server.
- The only API is what is shown here and in the
  [README](https://github.com/rtcstats/rtcstats/blob/main/packages/rtcstats-js/README.md).

## 2. Install

```sh
npm install @rtcstats/rtcstats-js
```

It is an ES module (`"type": "module"`) that imports `@rtcstats/rtcstats-shared`, so it needs a
bundler (Vite, webpack, esbuild, ...) or an import map. There is no published CDN bundle. For a
plain `<script>` page without a build step, build one as described under "Bundling" in the README;
it exposes a global `rtcstats` with the same functions.

## 3. Initialise before any WebRTC use

rtcstats-js replaces `window.RTCPeerConnection` with a wrapping constructor and replaces
`navigator.mediaDevices.getUserMedia`/`getDisplayMedia`/`enumerateDevices`. Code that grabbed
a reference before that is NOT traced:
- `const PC = window.RTCPeerConnection` or `class X extends RTCPeerConnection` evaluated before
  wrapping creates connections without `create`, events or `getStats` polling.
- `const gum = navigator.mediaDevices.getUserMedia.bind(...)` captured before wrapping bypasses tracing.
- Connections created in other windows/iframes are not wrapped.

So:
1. Find the app's earliest client entry point (`index.html` first `<script>`, `src/main.*`,
   `src/index.*`, the bundler's `entry`/`input`, Next.js/Nuxt client entry).
2. Create a dedicated module, e.g. `src/rtcstats.js`, and import it as the **first import** of
   that entry (ES imports are evaluated in order, so put it above any video SDK, adapter.js, or
   app code). Do not lazy-load it.
3. Check: grep the app's source and its WebRTC/video SDK packages in `node_modules` for
   `RTCPeerConnection`, `getUserMedia` and `getDisplayMedia` used at module top level (outside
   functions). Such modules are fine only if they are evaluated after `src/rtcstats.js`, i.e.
   imported after it. A `<script>` tag SDK in `index.html` must come after the rtcstats bundle.
4. Setup specifics:
   - Plain page: load the rtcstats bundle/module before every other script.
   - Vite/webpack: first import in the entry file.
   - SPA framework (React, Vue, Angular, Svelte): first import in `main.*`, not inside a component.
   - SSR (Next.js, Nuxt, SvelteKit, Remix): browser only. Guard with `typeof window !== 'undefined'`
     or a client-only entry/plugin (`'use client'` alone is not enough, it still renders on the
     server); it must still run before any component creates a connection.

```js
// src/rtcstats.js
import {wrapRTCStatsWithDefaultOptions} from '@rtcstats/rtcstats-js';

export const trace = wrapRTCStatsWithDefaultOptions({
    getStatsInterval: 1000,
    log: console.warn.bind(console),
});
```

Events are buffered in memory until `trace.connect()` is called, so wrapping early and connecting
later (step 5) loses nothing. Double-wrapping is a no-op.

## 4. Collector URL

- Ask the user for the URL of their rtcstats-server. Never invent or guess one.
- It is a WebSocket URL: `wss://host[:port][/path]` (`ws://` only for localhost; the server does
  not do TLS itself and normally sits behind a TLS-terminating proxy). Path and query string are
  recorded in the dump, so a path like `/<app-name>` is useful for telling apps apart.
- Read it from config/env, e.g. `import.meta.env.VITE_RTCSTATS_URL`, `process.env.NEXT_PUBLIC_RTCSTATS_URL`.
  If unset, skip `connect()` so the app still works.
- No server yet? For local testing: `git clone https://github.com/rtcstats/rtcstats && cd rtcstats && npm install`, then
  - `npm start --workspace=example` runs the reference integration (`example/index.html`); it
    requires a JWT signed with the secret `secret` (see step 5). Read it to see a full integration.
  - `npm start --workspace=packages/rtcstats-server` runs the plain server on `ws://localhost:8080`
    with no authorization; dumps end up in `packages/rtcstats-server/upload/`.

## 5. Connect and pass user, conference and session

The server stores `user`, `conference` and `session` for each dump only from a JWT in the
`rtcstats-token` query parameter. There is no client-side setter.
- The token is a JWT (HS256) with payload `{rtcStats: {user, conference, session}}` (plus the usual
  `exp`), signed with the server's `authorization.jwtSecret`. Sign it **on the app's backend**
  (where it already authenticates the user and creates rooms); never ship the secret to the browser.
  Read the secret from a server-side env var such as `RTCSTATS_JWT_SECRET`; never give it a
  client-exposed prefix (`VITE_`, `NEXT_PUBLIC_`, `REACT_APP_`, ...).
  ```js
  import jwt from 'jsonwebtoken';
  const token = jwt.sign({rtcStats: {user, conference, session}}, RTCSTATS_JWT_SECRET, {expiresIn: 3600});
  ```
- `user`: long-lived user id. `conference`: room/call id (groups dumps of all participants).
  `session`: short-lived id for this user's session/join.
- Find where the app knows these (auth state, the join-room handler, the signaling server's join
  response) and return the token from there.
- If the server has no `jwtSecret`, it accepts any connection but stores no identity. If it has one,
  a missing or invalid token closes the socket with code 1008 and nothing is recorded, so do not
  connect without a token.
- These fields go into the server's database row for the dump (`rtcstats_user`,
  `rtcstats_conference`, `rtcstats_session`), not into the dump file; the URL in the dump shows
  `rtcstats-token=obfuscated`.

Connect once the token is known, typically right after joining a room:
```js
import {trace} from './rtcstats.js';

trace.connect(RTCSTATS_URL + '?rtcstats-token=' + encodeURIComponent(token));
```
Each WebSocket connection is one dump. On leaving a room in a long-lived page (SPA), call
`trace.close()`; on joining the next room call `trace.connect(...)` again with a new token.
Wrapping stays active after `close()`; events from then on are buffered for the next `connect()`.
If identity is never known (anonymous app, no auth), connect at startup without a token.

Custom events go into the same dump: `trace(':userRating', null, {score: 4})` (name must start with
`:`; second argument is an `RTCPeerConnection` or `null`).

## 6. Configuration

Pass these in the object given to `wrapRTCStatsWithDefaultOptions(config)`. Passing an object
replaces the default `{getStatsInterval: 1000}`, so always include `getStatsInterval`.

| option | default | meaning |
| --- | --- | --- |
| `getStatsInterval` | `1000` (only if no config is passed) | ms between `getStats()` polls; falsy disables polling |
| `excludeDeviceLabels` | `false` | replace camera/mic labels with `''` |
| `countReloads` | `false` | count page loads per tab in `sessionStorage` |
| `log` | none | callback for WebSocket errors and 1008 auth failures |

For wrapping APIs individually (`WebSocketTrace`, `wrapRTCPeerConnection`, ...) see the README.

## 7. Verify

1. Run the app and the collector, open the page, make a call (connect a peer, ideally with media)
   for at least ~10 seconds, then hang up or close the tab.
2. Server output: `Accepted new connection with uuid ...` on connect, then `... disconnected,
   starting to process data` and `Processed data from connection with uuid ...` after close.
   Locally the file is `packages/rtcstats-server/upload/<uuid>` (or printed by the example server).
   Elsewhere, check the configured S3 bucket / database table.
   Identity: with a database configured, check the dump's row; without one the server logs
   `Not inserting into database ... rtcStats: {user, conference, session}`.
3. The dump is JSON lines with compressed method names: line 1 `RTCStatsDump`, line 2 metadata
   (`url`, `origin`, `userAgent`, `clientProtocol: "rtcstats#5.0"`), then events like
   `[<method>, "PC_0", <data>, <delta>]` where `<method>` is mostly a number. Check that each
   connection id (`PC_0`, `PC_1`, ...) appears with SDP in its data and with repeated `["g","PC_0",...]`
   lines (getStats, one per `getStatsInterval`). The `dump-importer` in the rtcstats repo renders it.
4. If nothing arrives, in the browser DevTools:
   - Network tab, filter "WS": a connection to the collector URL with subprotocol `rtcstats#5.0`
     and outgoing frames. None at all: `connect()` was never called (URL env var unset?).
   - Closed with code 1008 / `log` reports it: token missing, expired or signed with another secret.
   - Mixed content: an `https` page needs `wss://`.
   - In the console, `RTCPeerConnection.prototype.__rtcStats` should be `true`. If the WebSocket
     works but there is no `create` for your connection, something created it from a reference
     captured before wrapping (step 3).
   - Only one line per connection and no `getstats`: the connection never reached `connected`
     or `getStatsInterval` was not set.

## 8. Privacy: tell the user, don't decide

Before finishing, tell the user that dumps contain IP addresses (ICE candidates, SDP, stats; the
server obfuscates them by default with `server.obfuscateIpAddresses`), full SDP, device labels
(unless `excludeDeviceLabels`), user agent and screen size, and the identifiers from the token. They
need to check this against their consent, privacy policy and data-retention requirements.
Do not enable or disable options on their behalf for this reason; ask.

## 9. Optional: analysis

rtcstats-server can additionally forward collected dumps to rtcstats.com for analysis. This is
configured on the server only; see
[Uploading dumps to rtcstats.com](https://github.com/rtcstats/rtcstats/blob/main/packages/rtcstats-server/README.md#uploading-dumps-to-rtcstatscom).
