import config from 'config';
import maxmind from 'maxmind';

import {obfuscateIpOrAddress} from '@rtcstats/rtcstats-shared/address-obfuscator.js';

let maxmindLookup;
async function lookupAddress(ipAddress) {
    if (config.maxmind.path && !maxmindLookup) {
        maxmindLookup = await maxmind.open(config.maxmind.path);
    }
    return maxmindLookup.get(ipAddress);
}

async function extractMetadata(upgradeRequest) {
    // The url the client is coming from
    const url = upgradeRequest.url;
    // TODO: check origin against known/valid urls?
    const {origin} = upgradeRequest.headers;

    const userAgent = upgradeRequest.headers['user-agent'];

    const forwardedFor = upgradeRequest.headers['x-forwarded-for'];
    let remoteAddresses;
    if (forwardedFor) {
        const forwardedIPs = forwardedFor.split(',');
        remoteAddresses = forwardedIPs;
    } else {
        const {remoteAddress} = upgradeRequest.connection;
        remoteAddresses = [remoteAddress];
    }
    let locations;
    if (config.maxmind.path) {
        locations = await Promise.all(remoteAddresses.map(lookupAddress));
    }
    // Obfuscate only after feeding to geolocation.
    if (config.server.obfuscateIpAddresses) {
        remoteAddresses = remoteAddresses.map(obfuscateIpOrAddress);
    }

    const clientProtocol = upgradeRequest.headers['sec-websocket-protocol'];

    return {
        url,
        origin,
        userAgent,
        startTime: Date.now(),
        remoteAddresses,
        locations,
        clientProtocol,
        fileFormat: config.rtcStats.fileFormat,
    };
}

export async function handleWebSocket(socket, clientid, upgradeRequest, writeStream) {
    const metadata = await extractMetadata(upgradeRequest);

    // First line is 'RTCStatsDump'. File format version is on second line in JSON.
    writeStream.write('RTCStatsDump\n');
    // Second line of the file is a JS(ON) object.
    writeStream.write(JSON.stringify(metadata) + '\n');

    // Subscribe to events. Socket should be paused.
    let lastMessage = Date.now();
    let messages = 0;
    socket.on('message', msg => {
        messages++;
        lastMessage = Date.now();
        writeStream.write(msg + '\n');
    });
    socket.on('close', (code) => {
        // Code is the websocket close error.
        writeStream.write(JSON.stringify(['close', null, code, Date.now() - lastMessage]));
        // Update metadata.
        metadata.websocketClose = code;
        metadata.numberOfMessages = messages;
        metadata.stopTime = Date.now();

        // Close the write stream.
        writeStream.end();
    });
    // Resume the socket.
    socket.resume();

    // Return number of messages handled and metadata.
    return new Promise(resolve => {
        writeStream.on('finish', () => resolve({numberOfMessages: messages, metadata}));
    });
};
