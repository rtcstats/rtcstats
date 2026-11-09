# rtcstats-node-shared

Shared Node.js infrastructure used by the other rtcstats server-side packages.
It provides abstractions for blob storage (S3-compatible) and the Postgres
database, each falling back to a no-op when not configured.

## Contents

- `storage/`
  - `createStorage(config)` - returns an S3-compatible storage backend (AWS S3,
    DigitalOcean Spaces, ...) or a no-op when storage is not configured.
  - `ObfuscateStream` - `Transform` that obfuscates IP addresses in a dump file.
  - `GeolookupStream` - `Transform` that annotates TURN candidate addresses with
    a geo location, using a lookup function provided by the caller.
- `database/`
  - `createDatabase(config)` - returns a Postgres-backed database handle or a
    no-op when Postgres is not configured.
