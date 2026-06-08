import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';
import {parseArgs} from 'node:util';

import config from 'config';

import {RTCStatsServer} from './rtcstats-server.js';
import {setupDirectory} from './utils.js';

// Command-line parameters.
//   --host-identifier <string>  Identifier for this server, stored with every
//                               dump to attribute it to the server that
//                               received it. Undefined when not provided.
const {values: args} = parseArgs({
    strict: false,
    options: {
        'host-identifier': {type: 'string'},
    },
});
const hostIdentifier = args['host-identifier'];

// Setup unhandled exception and rejection handlers in production. Async event
// handlers (e.g. ws 'connection', http 'request') return promises the emitter
// never awaits, so a rejection there would otherwise terminate the process.
if (process.env.NODE_ENV === 'production') {
    process.on('uncaughtException', (err, origin) => {
        console.error('Caught exception:', err, 'Exception origin:', origin);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled rejection:', reason, 'Promise:', promise);
    });
}
const cpus = os.availableParallelism();
const configuredProcesses = config.server.numberOfProcesses || 0;

const numProc = process.env.NODE_ENV === 'production'
    ? (configuredProcesses > 0 ? Math.min(configuredProcesses, cpus) : cpus)
    : 1;

if (cluster.isPrimary) {
    // Setup work and upload directories once, in the primary, before forking.
    // Workers only need the directories to exist; running this per-worker would
    // race (and with deleteAtStart, delete files other workers are writing).
    setupDirectory(config, config.server.workDirectory);
    setupDirectory(config, config.server.uploadDirectory);

    console.log('Primary process running with', numProc, 'child processes');
    for (let i = 0; i < numProc; i++) {
        cluster.fork();
    }
} else {
    const server = new RTCStatsServer({...config, hostIdentifier});
    server.listen();
}
