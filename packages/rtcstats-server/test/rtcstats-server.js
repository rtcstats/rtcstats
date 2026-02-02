import config from 'config';
import {WebSocket} from 'ws';

import {RTCStatsServer} from '../rtcstats-server.js';
import {generateAuthToken, setupDirectory} from '../utils.js';

const baseConfig = structuredClone(config);
baseConfig.storage = {};
baseConfig.database = {};

const blob = new Blob([
    'RTCStatsDump\n' +
    '{"fileFormat":3}\n' +
    '[39,null,{},1]\n'
], {type: 'application/jsonl'});

describe('RTCStatsServer', () => {
    beforeEach(() => {
        // Setup up work and upload directories.
        setupDirectory(config, config.server.workDirectory);
        setupDirectory(config, config.server.uploadDirectory);
    });

    let server;
    afterEach(async () => {
        if (server) {
            await server.close();
        }
    });

    it('starts and stops', async () => {
        server = new RTCStatsServer(baseConfig);
        await server.listen();
        await server.close();
    });

    it('responds to a healtcheck', async () => {
        server = new RTCStatsServer(baseConfig);
        await server.listen();
        const res = await fetch('http://localhost:' + config.server.httpPort + '/healthcheck');
        expect(res.ok).to.equal(true);
    });

    it('responds to a unknown url', async () => {
        server = new RTCStatsServer(baseConfig);
        await server.listen();
        const res = await fetch('http://localhost:' + config.server.httpPort + '/unknown');
        expect(res.ok).to.equal(false);
        expect(res.status).to.equal(404);
    });

    it('connects and disconnects a websocket', async () => {
        const conf = structuredClone(baseConfig);
        conf.authorization = {};
        server = new RTCStatsServer(conf);
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

    describe('HTTP upload', () => {
        it('rejects a http upload missing the rtcstats signature', async() => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {};
            conf.server.httpUploadPath = '/upload';
            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', new Blob(['NOT AN RTCSTATS FILE']), 'test.jsonl');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(400);
            await server.close();
        });
        it('rejects a http upload without formdata', async() => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {};
            conf.server.httpUploadPath = '/upload';
            server = new RTCStatsServer(conf);
            await server.listen();

            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: 'zzz',
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(400);
            await server.close();
        });
        it('rejects a http upload missing the rtcstats metadata', async() => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {};
            conf.server.httpUploadPath = '/upload';
            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', new Blob(['RTCStatsDump\nzzz\n']), 'test.jsonl');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(400);
            await server.close();
        });
        it('rejects a http upload with non-json rtcstats metadata', async() => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {};
            conf.server.httpUploadPath = '/upload';
            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', new Blob(['RTCStatsDump\n{aaa}\n']), 'test.jsonl');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(400);
            await server.close();
        });
        it('accepts a valid http upload', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {};
            conf.server.httpUploadPath = '/upload';
            conf.storage = {};
            conf.database = {};
            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', blob, 'test.jsonl');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.true;
            await server.close();
        });
    });

    it('writes data', async () => {
        const conf = structuredClone(baseConfig);
        conf.authorization = {};
        server = new RTCStatsServer(conf);
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

    describe('WebSocket JWT authorization', () => {
        const jwtSecret = 'testSecret';
        it('rejects a websocket if authorization is configured', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            server = new RTCStatsServer(conf);
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
        it('rejects a websocket with an invalid token', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            server = new RTCStatsServer(conf);
            await server.listen();

            const token = await generateAuthToken({user: 'testUser'}, jwtSecret + 'invalid');
            const ws = new WebSocket('ws://localhost:' + config.server.httpPort + '?rtcstats-token=' + token);
            const closePromise = new Promise(resolve => {
                ws.on('close', (code) => {
                    resolve(code);
                });
            });
            expect(await closePromise).to.equal(1008);
            await server.close();
        });

        it('accepts a websocket with a valid token', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            server = new RTCStatsServer(conf);
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

    describe('HTTP upload JWT authorization', () => {
        const jwtSecret = 'httpSecret';
        it('rejects upload if authorization is configured', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            conf.server.httpUploadPath = '/upload';

            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', blob, 'test.jsonl');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload', {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(403);
            await server.close();
        });
        it('rejects upload with an invalid token', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            conf.server.httpUploadPath = '/upload';

            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', blob, 'test.jsonl');
            const token = await generateAuthToken({user: 'testUser'}, jwtSecret + 'invalid');
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload' + '?rtcstats-token=' + token, {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.false;
            expect(result.status).to.equal(403);
            await server.close();
        });
        it('accepts upload with a valid token', async () => {
            const conf = structuredClone(baseConfig);
            conf.authorization = {jwtSecret};
            conf.server.httpUploadPath = '/upload';

            server = new RTCStatsServer(conf);
            await server.listen();

            const formData = new FormData();
            formData.append('dump', blob, 'test.jsonl');
            const token = await generateAuthToken({user: 'testUser'}, jwtSecret);
            const result = await fetch('http://localhost:' + conf.server.httpPort + '/upload' + '?rtcstats-token=' + token, {
                method: 'POST',
                body: formData,
            });
            expect(result.ok).to.be.true;
            expect(result.status).to.equal(200);
            await server.close();
        });
    });
});
