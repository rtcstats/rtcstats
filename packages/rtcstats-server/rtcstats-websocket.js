import config from 'config';
import maxmind from 'maxmind';

let maxmindLookup;
async function lookupAddress(ipAddress) {
    if (config.maxmind.path && !maxmindLookup) {
        maxmindLookup = await maxmind.open(config.maxmind.path);
    }
    return maxmindLookup.get(ipAddress);
}

async function extractMetadata(upgradeReq, authData) {
    // The url the client is coming from
    const url = upgradeReq.url;
    // TODO: check origin against known/valid urls?
    const {origin} = upgradeReq.headers;

    const userAgent = upgradeReq.headers['user-agent'];

    const forwardedFor = upgradeReq.headers['x-forwarded-for'];
    let remoteAddresses;
    if (forwardedFor) {
        const forwardedIPs = forwardedFor.split(',');
        remoteAddresses = forwardedIPs;
    } else {
        const {remoteAddress} = upgradeReq.connection;
        remoteAddresses = [remoteAddress];
    }
    let locations;
    if (config.maxmind.path) {
        locations = await Promise.all(remoteAddresses.map(lookupAddress));
    }

    const clientProtocol = upgradeReq.headers['sec-websocket-protocol'];

    return {
        url,
        origin,
        userAgent,
        startTime: Date.now(),
        remoteAddresses,
        locations,
        clientProtocol,
        authData,
        fileFormat: config.rtcStats.fileFormat,
    };
}

export async function handleWebSocket(client, clientid, upgradeReq, authData, writeStream) {
    const metadata = await extractMetadata(upgradeReq, authData);

    // First line is 'RTCStatsDump'. File format version is on second line in JSON.
    writeStream.write('RTCStatsDump\n');
    // Second line of the file is a JS(ON) object.
    writeStream.write(JSON.stringify(metadata) + '\n');

    let lastMessage = Date.now();
    let messages = 0;
    client.on('message', msg => {
        writeStream.write(msg + '\n');
        lastMessage = Date.now();
        messages++;
    });

    client.on('error', e => {
        console.error(`Websocket error: ${e}`);
    });
    client.on('close', (code) => {
        // Code is the websocket close error.
        writeStream.write(JSON.stringify(['close', null, code, Date.now() - lastMessage]));
        // Update metadata.
        metadata.websocketClose = code;
        metadata.numberOfMessages = messages;
        metadata.stopTime = Date.now();
        writeStream.end();
    });
    // Return number of messages handled.
    return new Promise(resolve => {
        writeStream.on('finish', () => resolve({numberOfMessages: messages, metadata}));
    });
};
