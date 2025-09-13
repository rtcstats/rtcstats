import fs from 'node:fs';
import path from 'node:path';

import config from 'config';

import {RTCStatsServer} from './rtcstats-server.js';

// Synchronous setup for work and upload directories.
export function setupDirectory(name) {
    try {
        if (fs.existsSync(name)) {
            if (config.server.deleteAtStart) {
                fs.readdirSync(name).forEach(fname => {
                    try {
                        console.log(`Removing file ${path.join(name, fname)}`);
                        fs.unlinkSync(path.join(name, fname));
                    } catch (e) {
                        console.error(`Error while unlinking file ${fname} - ${e.message}`);
                    }
                });
            }
        } else {
            console.log(`Creating working dir ${name}`);
            fs.mkdirSync(name);
        }
    } catch (e) {
        console.error(`Error while accessing working dir ${name} - ${e.message}`);
    }
}

// Setup up work and upload directories.
setupDirectory(config.server.workDirectory);
setupDirectory(config.server.uploadDirectory);

const server = new RTCStatsServer();
server.listen();
