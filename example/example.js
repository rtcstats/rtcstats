import fs from 'node:fs';
import path from 'node:path';

import config from 'config';
import opener from 'opener';
import jwt from 'jsonwebtoken';

import {RTCStatsServer} from '@rtcstats/rtcstats-server/rtcstats-server.js';

// Synchronous setup for work and upload directories.
export function setupDirectory(name) {
    try {
        if (fs.existsSync(name)) {
            fs.readdirSync(name).forEach(fname => {
                try {
                    console.log(`Removing file ${path.join(name, fname)}`);
                    fs.unlinkSync(path.join(name, fname));
                } catch (e) {
                    console.error(`Error while unlinking file ${fname} - ${e.message}`);
                }
            });
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

config.server.deleteAfterUpload = false;
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
                            path.join(process.cwd(), config.server.workDirectory, filename));
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

const server = new RTCStatsAndHttpServer();
server.listen();

// This section shows JWT-based authorization with a shared secret.
// It generates a token with an rtcStats object than can be used for
// authenticated user and conference (or session) metadata.
// This is passed to the sample page which passes the token during
// the websocket connection.
config.authorization.jwtSecret = 'secret';
jwt.sign({
    rtcStats: {
        user: 'example',
        conference: 'krankygeek',
    },
}, config.authorization.jwtSecret, {expiresIn: 60/* seconds */}, (err, token) => {
    if (err) {
        console.error(err);
        return;
    }
    // Open the browser at the indicated url.
    opener('http://localhost:' + config.server.httpPort + '/?rtcstats-token=' + token);
});

