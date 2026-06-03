# rtcstats-node-shared

Node-only infrastructure shared between the server-side rtcStats components
(`rtcstats-server`, `rtcstats-features`).

Unlike [`rtcstats-shared`](../rtcstats-shared), which is the isomorphic
wire-format contract that must run in both the browser SDK and Node, this
package is **Node-only**: it may use Node built-ins and Node-only dependencies
(`postgres`, the AWS S3 SDK, `sdp`) and must never be imported from the browser.

The rule of thumb for where a file belongs: *does it need to run in a browser?*
If yes, it goes in `rtcstats-shared`. If no, and it is used by more than one
server-side component, it goes here.

## Contents

- `storage/` - blob storage backends and the dump-rewriting stream transforms.
  - `createStorage(config)` - returns an S3-compatible storage backend (AWS S3,
    DigitalOcean Spaces, ...) or a no-op when storage is not configured.
  - `ObfuscateStream` - `Transform` that obfuscates IP addresses in a dump file.
  - `GeolookupStream` - `Transform` that annotates TURN candidate addresses with
    a geo location. The address lookup function is injected by the caller (the
    server owns the MaxMind database).
- `database/` - the Postgres access layer.
  - `createDatabase(config)` - returns a Postgres-backed database handle (raw
    `sql` plus the insert/update helpers) or a no-op when Postgres is not
    configured.

## Usage

```js
import {createStorage, createDatabase} from '@rtcstats/rtcstats-node-shared';
```
