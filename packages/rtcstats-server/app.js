import cluster from 'node:cluster';
import os from 'node:os';
import process from 'node:process';

import config from 'config';

import {RTCStatsServer} from './rtcstats-server.js';
import {setupDirectory} from './utils.js';

// Setup work and upload directories.
setupDirectory(config, config.server.workDirectory);
setupDirectory(config, config.server.uploadDirectory);

// Setup unhandled exception handler in production.
if (process.env.NODE_ENV === 'production') {
    process.on('uncaughtException', (err, origin) => {
    console.error('Caught exception:', err, 'Exception origin:', origin);
  });
}
const cpus = os.availableParallelism();
const configuredProcesses = config.server.numberOfProcesses || 0;

const numProc = process.env.NODE_ENV === 'production'
    ? (configuredProcesses > 0 ? Math.min(configuredProcesses, cpus) : cpus)
    : 1;

if (cluster.isPrimary) {
    console.log('Primary process running with', numProc, 'child processes');
    for (let i = 0; i < numProc; i++) {
        cluster.fork();
    }
} else {
    const server = new RTCStatsServer(config);
    server.listen();
}
