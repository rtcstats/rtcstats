import fs from 'node:fs';
import path from 'node:path';

import config from 'config';
import opener from 'opener';

import {RTCStatsServer} from '@rtcstats/rtcstats-server/rtcstats-server.js';
import {generateAuthToken, setupDirectory} from '@rtcstats/rtcstats-server/utils.js';

class RTCStatsAndHttpServer extends RTCStatsServer{
    // Override HTTP behavior.
    handleHttpRequest(request, response) {
        if (request.url.startsWith('/packages/rtcstats-') && request.url.endsWith('.js')) {
            fs.readFile('..' + request.url, (error, content) => {
                response.writeHead(200, {'Content-Type': 'text/javascript'});
                response.end(content, 'utf-8');
            });
        } else if (request.url.startsWith('/?')) {
            fs.readFile('./index.html', (error, content) => {
                response.writeHead(200, {'Content-Type': 'text/html'});
                response.end(content, 'utf-8');
            });
        } else {
            return super.handleHttpRequest(request, response);
        }
    }
    // Override storage behavior.
    createStorage(storageConfig) {
        return {
            put: async (key, filename) => {
                console.log('RTCStats dump generated in ' +
                            path.join(process.cwd(), filename));
            },
        };
    }
    // Override database behavior.
    createDatabase(databaseConfig) {
        return {
            dump: () => {}
        };
    }
}

// Setup up work and upload directories.
setupDirectory(config, config.server.workDirectory);
setupDirectory(config, config.server.uploadDirectory);

config.server.deleteAfterUpload = false;
config.authorization.jwtSecret = 'secret';
const server = new RTCStatsAndHttpServer(config);
server.listen();

// This section shows JWT-based authorization with a shared secret.
// It generates a token with an rtcStats object than can be used for
// authenticated user and conference (or session) metadata.
// This is passed to the sample page which passes the token during
// the websocket connection.
generateAuthToken({
    user: 'example',
    session: 'unique-id',
    conference: 'krankygeek',
}, config.authorization.jwtSecret).then((token) => {
    // Open the browser at the indicated url.
    opener('http://localhost:' + config.server.httpPort + '/?rtcstats-token=' + token);
});

