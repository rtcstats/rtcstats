# Feature extraction
This package contains [feature extraction](https://en.wikipedia.org/wiki/Feature_extraction)
for peerconnection API traces and getStats data. There are four types of features:
* Features related to server-side metadata such as location.
* Features related to the client as a whole, e.g. calls to `getUserMedia` and errors.
* Features related to a particular RTCPeerConnection and the API calls happening to it.
* Features related to a inbound or outbound MediaStreamTrack, mostly based on `getStats` API.

Running
```
npm start
```
will query the database for a unprocessed dumps, download it, extract the features and
insert the features into the database. If no unprocessed dumps are found,
the process waits five seconds before trying again.

## Database structure
The feature extraction polls for new records from the `rtcstats-server` table for features that
have not yet been processed. The associated dump is fetched for local processing and features are extracted.

There is a 1:1 relationship between the `features_metadata` and the `rtcstats-table` entry.
The main table is `rtcstats-server`, which contains the metadata for each dump, identified by a unique `id`.

The extracted features are stored in a set of tables:
- `features_metadata`: This table contains high-level metadata about the dump, such as the URL, user agent, and the number of peer connections. It has a foreign key `dump_id` that references the `id` in the `rtcstats-server` table.
- `features_client`: This table contains information about the client environment, such as hardware concurrency and screen resolution. It has a foreign key `dump_id` that references the `id` in the `features_metadata` table.
- `features_connection`: This table contains features related to a single `RTCPeerConnection`. It has a foreign key `dump_id` that references the `id` in the `features_metadata` table.
- `features_track`: This table contains features related to a single media track within a peer connection. It has a foreign key `connection_id` that references the `id` in the `features_connection` table.

This structure allows for a dump in `rtcstats-server` to have one `features_metadata` entry, which in turn is associated with one `features_client` entry, multiple `features_connection` entries, and each of those connections can have multiple `features_track` entries. This is visualized below:
```
  +-------------------+
  | rtcstats-server   |
  |-------------------|
+-+ id (PK)           |
| +-------------------+
|
| (1-to-1)
|
| +-------------------+
| | features_metadata |
| |-------------------|
| | id (PK)           +-+----------------------------------+
+-+ dump_id (FK)      | |                                  |
  +-------------------+ | (1-to-1)             (1-to-many) |
                        |                                  |
  +-------------------+ |          +---------------------+ |
  | features_client   | |          | features_connection | |
  |-------------------| |          |---------------------| |
  | id (PK)           | |        +-+ id (PK)             | |
  | dump_id (FK)      +-+        | | dump_id (FK)        +-+
  +-------------------+          | +---------------------+
                                 |
                                 | +---------------------+
                                 | | features_track      |
                                 | |---------------------|
                                 | | id (PK)             |
                                 +-+ connection_id (FK)  |
                                   +---------------------+
```

Given a serverside `id` (or a `blob_url`) the associated features can be queried using
```
select * from "rtcstats-server" as server
    join features_metadata on features_metadata.dump_id = server.id
    join features_client on features_client.dump_id = features_metadata.id
    join features_connection on features_connection.dump_id = features_metadata.id
    join features_track on features_track.connection_id = features_connection.id
    where server.id = ${id}
```
