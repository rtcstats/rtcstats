import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid';
import config from 'config';
import jwt from 'jsonwebtoken';

import {handleWebSocket} from './rtcstats-websocket.js';
import {obfuscateStream} from './obfuscate-stream.js';
import {createStorage} from './storage/index.js';
import {createDatabase} from './database/index.js';

export class RTCStatsServer {
    constructor() {
        this.storage = this.createStorage(config.storage);
        this.database = this.createDatabase(config.database);
        this.server = http.Server({}, () => { })
            .on('request', this.handleHttpRequest.bind(this));
        this.wss = new WebSocketServer({server: this.server});
        this.wss.on('connection', this.handleWebSocket.bind(this));
    }

    createStorage(storageConfig) {
        return createStorage(storageConfig);
    }
    createDatabase(databaseConfig) {
        return createDatabase(databaseConfig);
    }

    handleHttpRequest(request, response) {
        switch (request.url) {
            case '/healthcheck':
                response.writeHead(200);
                response.end();
                break;
            default:
                response.writeHead(404);
                response.end();
        }
    }

    async authorizeWebSocket(socket, upgradeRequest) {
        if (!(config.authorization && config.authorization.jwtSecret)) {
            return true;
        }
        const urlParts = url.parse(upgradeRequest.headers.origin + upgradeRequest.url, true);
        if (!urlParts || !urlParts.query['rtcstats-token']) {
            console.warn('Authentication is configured but rtcstats-token is missing');
            return false;
        }
        return await new Promise(resolve => {
            jwt.verify(urlParts.query['rtcstats-token'], config.authorization.jwtSecret, (err, res) => {
                if (err) {
                    console.warn('Authenication failed', err);
                    return resolve(false);
                }
                resolve(res);
            });
        });
    }

    async handleWebSocket(socket, upgradeRequest) {
        const authData = await this.authorizeWebSocket(socket, upgradeRequest);
        if (authData === false) {
            socket.close(1008); // Policy-violation error.
            return;
        }

        const startTime = Date.now();
        const clientid = uuidv4();
        const workPath = path.join(config.server.workDirectory, clientid);
        const writeStream = fs.createWriteStream(workPath);
        const {numberOfMessages, metadata} = await handleWebSocket(socket, clientid, upgradeRequest, authData, writeStream);
        if (numberOfMessages === 0) {
            // Drop empty files.
            await fsPromises.unlink(workPath);
            return;
        }
        const endTime = Date.now();
        process.nextTick(async() => {
            this.process(clientid, startTime, endTime, metadata);
        });
    }

    async process(clientid, startTime, endTime, metadata) {
        const destPath = await this.postProcess(clientid);
        const blobUrl = await this.uploadDump(clientid, destPath);
        /*const result = */await this.storeDatabase(clientid, startTime, endTime, blobUrl, metadata);
        // result[0].id is the insertion id.
    }

    async postProcess(clientid) {
        // Take the file and obfuscate IP addresses.
        const sourcePath = path.join(config.server.workDirectory, clientid);
        const destPath = path.join(config.server.uploadDirectory, clientid);
        if (config.server.obfuscateIpAddresses) {
            const source = await fsPromises.open(sourcePath);
            const dest = await fsPromises.open(destPath, 'w');
            await obfuscateStream(source.createReadStream(), dest.createWriteStream());
            source.close();
            dest.close();
        } else {
            await fsPromises.copyFile(sourcePath, destPath);
        }
        await fsPromises.unlink(sourcePath);
        return destPath;
    }

    async uploadDump(clientid, destPath) {
        // Upload to storage and unlink the destination path.
        const blobLocation = await this.storage.put(clientid, destPath);
        if (config.server.deleteAfterUpload) {
            await fsPromises.unlink(destPath);
        }
        return blobLocation;
    }

    async storeDatabase(clientid, startTime, endTime, blobUrl, metadata) {
        return this.database.dump(clientid, startTime, endTime, blobUrl, metadata);
    }

    async listen() {
        return new Promise((resolve, reject) => {
            this.server.listen(config.server.httpPort, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }
    async close() {
        return this.server.close();
    }
}
