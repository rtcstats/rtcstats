import config from 'config';

import {RTCStatsServer} from './rtcstats-server.js';
import {setupDirectory} from './utils.js';

// Setup up work and upload directories.
setupDirectory(config, config.server.workDirectory);
setupDirectory(config, config.server.uploadDirectory);

const server = new RTCStatsServer(config);
server.listen();
