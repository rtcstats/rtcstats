// Applies IP address obfuscation to a dump file.
import readline from 'node:readline';

import {decompressMethod} from '@rtcstats/rtcstats-shared';
import {obfuscateAddress} from '@rtcstats/rtcstats-shared/address-obfuscator.js';

export async function obfuscateStream(readStream, writeStream) {
    const readLine = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
        historySize: 0,
    });
    for await (const line of readLine) {
        if (line.startsWith('RTCStatsDump')) {
            writeStream.write(line + '\n');
            continue;
        }
        try {
            const data = JSON.parse(line);
            obfuscateAddress(decompressMethod(data[0]), data);
            writeStream.write(JSON.stringify(data) + '\n');
        } catch (e) {
            console.error(`Error while processing: ${e} - ${line}`);
        }
    }
    readLine.close();
}
