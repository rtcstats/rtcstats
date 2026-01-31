import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid';
import jwt from 'jsonwebtoken';

import {handleWebSocket} from './rtcstats-websocket.js';
import {handleFileupload} from './rtcstats-upload.js';
import {ObfuscateStream} from './obfuscate-stream.js';
import {createStorage} from './storage/index.js';
import {createDatabase} from './database/index.js';

export class RTCStatsServer {
    constructor(config) {
        this.storage = this.createStorage(config.storage);
        this.database = this.createDatabase(config.database);
        this.server = http.Server({}, () => { })
            .on('request', this.handleHttpRequest.bind(this));
        this.wss = new WebSocketServer({server: this.server});
        this.wss.on('connection', this.handleWebSocket.bind(this));
        this.config = config;
    }

    createStorage(storageConfig) {
        return createStorage(storageConfig);
    }
    createDatabase(databaseConfig) {
        return createDatabase(databaseConfig);
    }

    async handleHttpRequest(request, response) {
        if (request.method === 'POST') {
            const urlParts = url.parse(request.url, true);
            if (urlParts.pathname === this.config.server.httpUploadPath) {
                const authData = await this.authorizeRequest(request);
                if (authData === false) {
                    response.writeHead(403, { 'Content-Type': 'text/plain' });
                    response.end('Forbidden');
                }

                // TODO: somewhat duplicated from below.
                const clientid = uuidv4();
                console.log('Accepted new HTTP upload with uuid', clientid);
                const workPath = path.join(this.config.server.workDirectory, clientid);
                const writeStream = fs.createWriteStream(workPath);
                let numberOfMessages;
                let metadata;
                try {
                    const result = await handleFileupload(clientid, request, response, writeStream);
                    numberOfMessages = result.numberOfMessages;
                    metadata = result.metadata;
                } catch (e) {
                    console.error('Uploading failed', workPath, e);
                    response.writeHead(500, { 'Content-Type': 'text/plain' });
                    response.end('Internal Server Error');
                    await fsPromises.unlink(workPath);
                    return;
                }
                if (numberOfMessages === 0) {
                    // Drop empty files.
                    await fsPromises.unlink(workPath);
                    return;
                }
                metadata.authData = authData;
                const endTime = Date.now();
                process.nextTick(async() => {
                    console.log('Connection with uuid', clientid, 'uploaded via HTTP, starting to process data');
                    this.process(clientid, metadata.startTime || Date.now(), endTime, metadata);
                });
                return;
            }
        }
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

    async authorizeRequest(request) {
        if (!(this.config.authorization && this.config.authorization.jwtSecret)) {
            return true;
        }
        const urlParts = url.parse(request.headers.origin + request.url, true);
        if (!urlParts || !urlParts.query['rtcstats-token']) {
            console.warn('Authentication is configured but rtcstats-token is missing');
            return false;
        }
        return await new Promise(resolve => {
            jwt.verify(urlParts.query['rtcstats-token'], this.config.authorization.jwtSecret, (err, res) => {
                if (err) {
                    console.warn('JWT authorization failed', err);
                    return resolve(false);
                }
                resolve(res);
            });
        });
    }

    async handleWebSocket(socket, upgradeRequest) {
        // Pause the socket so we can subscribe to the events later.
        socket.pause();
        const authData = await this.authorizeRequest(upgradeRequest);
        if (authData === false) {
            socket.resume();
            socket.close(1008); // Policy-violation error.
            console.warn('Client authorization failed');
            return;
        }
        const startTime = Date.now();
        const clientid = uuidv4();
        console.log('Accepted new connection with uuid', clientid);
        const workPath = path.join(this.config.server.workDirectory, clientid);
        const writeStream = fs.createWriteStream(workPath);
        const {numberOfMessages, metadata} = await handleWebSocket(socket, clientid, upgradeRequest, writeStream);
        if (numberOfMessages === 0) {
            // Drop empty files.
            await fsPromises.unlink(workPath);
            return;
        }
        metadata.authData = authData;
        const endTime = Date.now();
        process.nextTick(async() => {
            console.log('Connection with uuid', clientid, 'disconnected, starting to process data');
            this.process(clientid, startTime, endTime, metadata);
        });
    }

    async process(clientid, startTime, endTime, metadata) {
        const destPath = await this.postProcess(clientid);
        const blobUrl = await this.uploadDump(clientid, destPath);
        /*const result = */await this.storeDatabase(clientid, startTime, endTime, blobUrl, metadata);
        // result[0].id is the insertion id.
        console.log('Processed data from connection with uuid', clientid);
    }

    async postProcess(clientid) {
        // Take the file and obfuscate IP addresses.
        const sourcePath = path.join(this.config.server.workDirectory, clientid);
        const destPath = path.join(this.config.server.uploadDirectory, clientid);
        if (this.config.server.obfuscateIpAddresses) {
            const source = fs.createReadStream(sourcePath);
            const dest = fs.createWriteStream(destPath);
            await pipeline(source, new ObfuscateStream(), dest);
        } else {
            await fsPromises.copyFile(sourcePath, destPath);
        }
        await fsPromises.unlink(sourcePath);
        return destPath;
    }

    async uploadDump(clientid, destPath) {
        // Upload to storage and unlink the destination path.
        const blobLocation = await this.storage.put(clientid, destPath);
        if (this.config.server.deleteAfterUpload) {
            await fsPromises.unlink(destPath);
        }
        return blobLocation;
    }

    async storeDatabase(clientid, startTime, endTime, blobUrl, metadata) {
        return this.database.dump(clientid, startTime, endTime, blobUrl, metadata);
    }

    async listen() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.server.httpPort, (err) => {
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
