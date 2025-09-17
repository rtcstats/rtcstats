# rtcstats monorepo

This is a monorepo for rtcstats-js (clientside monitoring), rtcstats-server (serverside dump collection)
and the updated dump-importer (supporting rtcstats and webrtc-internals formats).

It is part of a bigger offering that includes [rtcstats.com](https://rtcstats.com),
an online service for debugging and troubleshooting WebRTC statistics.

See the individual README files for details: 
* [rtcstats-js](packages/rtcstats-js)
* [rtcstats-server](packages/rtcstats-server)
* [dump-importer](dump-importer/README.md)

# End-to-end example

To start the local example version, run
```
npm install
npm start --workspace=example
```
This will start a minimal server, open a browser window, run some WebRTC-related API calls.
Once done, a RTCStats dump file can be found in the example/upload/ directory which can be imported
on RTCStats or the built-in dump importer.

# Building

Running
```
npm test
```
will run linting and unit/e2e tests in all sub-packages.

# Previous versions

This repository contains the current version of the legacy
[rtcstats-js](https://github.com/fippo/rtcstats) and [rtcstats-server](https://github.com/fippo/rtcstats-server).
The old versions are no longer maintained, friendly forks such as the [Jitsi one](https://github.com/jitsi/rtcstats) exist.

We invite you to use this version. We plan on keeping it well maintained, modernized and well behaved for all WebRTC applications.
