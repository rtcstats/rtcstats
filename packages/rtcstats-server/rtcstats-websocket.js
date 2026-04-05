import {obfuscateIpOrAddress} from '@rtcstats/rtcstats-shared/address-obfuscator.js';

export async function extractMetadata(upgradeRequest, options = {}) {
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
    if (options.lookupAddress) {
        locations = await Promise.all(remoteAddresses.map(options.lookupAddress));
    }
    // Obfuscate only after feeding to geolocation.
    if (options.obfuscateIpAddresses) {
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
    };
}

export async function handleWebSocket(socket, clientId, metadata, writeStream) {
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

    // Return metadata immediately and a promise for when finished.
    const onFinished = new Promise(resolve => {
        writeStream.on('finish', () => resolve({numberOfMessages: messages, metadata}));
    });
    return onFinished;
};
