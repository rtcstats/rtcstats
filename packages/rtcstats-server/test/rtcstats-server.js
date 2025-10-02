import config from 'config';
import {WebSocket} from 'ws';

import {RTCStatsServer} from '../rtcstats-server.js';
import {generateAuthToken, setupDirectory} from '../utils.js';

describe('RTCStatsServer', () => {
    beforeEach(() => {
        // Setup up work and upload directories.
        setupDirectory(config, config.server.workDirectory);
        setupDirectory(config, config.server.uploadDirectory);
    });

    let server;
    it('starts and stops', async () => {
        server = new RTCStatsServer(config);
        await server.listen();
        await server.close();
    });

    it('connects and disconnects a websocket', async () => {
        const confWithoutAuth = structuredClone(config);
        confWithoutAuth.authorization = {};
        server = new RTCStatsServer(confWithoutAuth);
        await server.listen();

        const ws = new WebSocket('ws://localhost:' + config.server.httpPort);
        const openPromise = new Promise(resolve => {
            ws.on('open', () => {
                ws.close();
                resolve();
            });
        });
        await openPromise;
        await server.close();
    });

    it('writes data', async () => {
        const confWithoutAuth = structuredClone(config);
        confWithoutAuth.authorization = {};
        server = new RTCStatsServer(confWithoutAuth);
        await server.listen();

        const ws = new WebSocket('ws://localhost:' + config.server.httpPort);
        const sendPromise = new Promise(resolve => {
            ws.on('open', async () => {
                ws.send(JSON.stringify(['create', 'PC_0', {}, Date.now()]), () => {
                    ws.close();
                    resolve();
                });
            });
        });
        await sendPromise;
        await server.close();
    });

    describe('JWT authorization', () => {
        const jwtSecret = 'testSecret';
        it('rejects a websocket if authorization is configured', async () => {
            const confWithAuth = structuredClone(config);
            confWithAuth.authorization = {jwtSecret};
            server = new RTCStatsServer(confWithAuth);
            await server.listen();

            const ws = new WebSocket('ws://localhost:' + config.server.httpPort);
            const closePromise = new Promise(resolve => {
                ws.on('close', (code) => {
                    resolve(code);
                });
            });
            expect(await closePromise).to.equal(1008);
            await server.close();
        });

        it('accepts a websocket with a valid token', async () => {
            const confWithAuth = structuredClone(config);
            confWithAuth.authorization = {jwtSecret};
            server = new RTCStatsServer(confWithAuth);
            await server.listen();

            const token = await generateAuthToken({user: 'testUser'}, jwtSecret);
            const ws = new WebSocket('ws://localhost:' + config.server.httpPort + '?rtcstats-token=' + token);
            const openPromise = new Promise(resolve => {
                ws.on('open', () => {
                    ws.close();
                    resolve();
                });
            });
            await openPromise;
            await server.close();
        });
    });
});
