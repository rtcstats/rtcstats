import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';

import {WebSocketServer} from 'ws';
import {v4 as uuidv4} from 'uuid';
import jwt from 'jsonwebtoken';
import maxmind from 'maxmind';

import {handleWebSocket, extractMetadata} from './rtcstats-websocket.js';
import {handleFileupload} from './rtcstats-upload.js';
import {createStorage, ObfuscateStream, GeolookupStream} from './storage/index.js';
import {createRtcStatsUploader} from './storage/rtcstats-com.js';
import {createDatabase} from './database/index.js';

let maxmindLookup;
async function lookupAddress(ipAddress, maxmindPath) {
    if (maxmindPath && !maxmindLookup) {
        maxmindLookup = await maxmind.open(maxmindPath);
    }
    return maxmindLookup.get(ipAddress);
}

export class RTCStatsServer {
    constructor(config) {
        this.storage = this.createStorage(config.storage);
        this.database = this.createDatabase(config.database);
        this.rtcstatsUploader = this.createRtcStatsUploader(config.rtcstats);
        this.server = new http.Server({}, () => { })
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
    createRtcStatsUploader(rtcStatsConfig) {
        return createRtcStatsUploader(rtcStatsConfig);
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
                const clientId = uuidv4();
                console.log('Accepted new HTTP upload with uuid', clientId);
                const workPath = path.join(this.config.server.workDirectory, clientId);
                const writeStream = fs.createWriteStream(workPath);
                let result;
                try {
                    result = await handleFileupload(clientId, request, response, writeStream);
                } catch (e) {
                    console.error('Uploading failed', workPath, e);
                    response.writeHead(500, { 'Content-Type': 'text/plain' });
                    response.end('Internal Server Error');
                    await fsPromises.unlink(workPath);
                    return;
                }
                if (!result || result.numberOfMessages === 0) {
                    // Drop empty files.
                    await fsPromises.unlink(workPath);
                    return;
                }
                const {metadata} = result;
                const endTime = Date.now();
                const startTime = metadata.startTime || Date.now();
                const dbId = await this.database.insert(startTime, authData);
                process.nextTick(async() => {
                    console.log('Connection with uuid', clientId, 'uploaded via HTTP, starting to process data');
                    this.process(clientId, startTime, endTime, dbId);
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
        const clientId = uuidv4();
        console.log('Accepted new connection with uuid', clientId);
        const metadata = await extractMetadata(upgradeRequest, {
            lookupAddress: this.config.maxmind.path ? address => lookupAddress(address, this.config.maxmind.path) : undefined,
            obfuscateIpAddresses: this.config.server.obfuscateIpAddresses,
        });
        metadata.fileFormat = this.config.rtcStats.fileFormat;
        const dbId = await this.database.insert(startTime, authData);

        const workPath = path.join(this.config.server.workDirectory, clientId);
        const writeStream = fs.createWriteStream(workPath);
        const {numberOfMessages} = await handleWebSocket(socket, clientId, metadata, writeStream);
        if (numberOfMessages === 0) {
            // Drop empty files.
            await fsPromises.unlink(workPath);
            return;
        }
        const endTime = Date.now();
        process.nextTick(async() => {
            console.log('Connection with uuid', clientId, 'disconnected, starting to process data');
            this.process(clientId, startTime, endTime, dbId);
        });
    }

    async process(clientId, startTime, endTime, dbId) {
        const destPath = await this.postProcess(clientId);
        const blobUrl = await this.uploadDump(clientId, destPath);
        await this.database.update(dbId, endTime, blobUrl);
        console.log('Processed data from connection with uuid', clientId, 'dbІd', dbId);
    }

    async postProcess(clientId) {
        // Take the file and obfuscate IP addresses.
        const sourcePath = path.join(this.config.server.workDirectory, clientId);
        const destPath = path.join(this.config.server.uploadDirectory, clientId);
        if (this.config.server.obfuscateIpAddresses) {
            const source = fs.createReadStream(sourcePath);
            const dest = fs.createWriteStream(destPath);
            const transforms = [];
            if (this.config.maxmind.path) {
                transforms.push(new GeolookupStream({}, address => lookupAddress(address, this.config.maxmind.path)));
            }
            transforms.push(new ObfuscateStream);
            await pipeline(source, ...transforms, dest);
        } else {
            await fsPromises.copyFile(sourcePath, destPath);
        }
        await fsPromises.unlink(sourcePath);
        return destPath;
    }

    async uploadDump(clientId, destPath) {
        // Upload to storage and unlink the destination path.
        const blobLocation = await this.storage.put(clientId, destPath);

        if (this.rtcstatsUploader) {
            // Read data and upload to rtcstats.com if configured.
            const data = fs.readFileSync(destPath);
            data.name = clientId;
            data.size = data.length;
            try {
                await this.rtcstatsUploader(data);
            } catch (e) {
                // Should an error prevent deletion?
                console.error('Uploading to rtcstats.com failed', e);
            }
        }
        if (this.config.server.deleteAfterUpload) {
            await fsPromises.unlink(destPath);
        }
        return blobLocation;
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
