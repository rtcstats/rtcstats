import {Readable, Writable} from 'node:stream';

import {compressStatsProperty} from '@rtcstats/rtcstats-shared';

import {obfuscateStream} from '../obfuscate-stream.js';

async function obfuscate(input) {
    const readStream = Readable.from(input);
    let output = '';
    const writeStream = new Writable({
      write(chunk, encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    await obfuscateStream(readStream, writeStream);
    return output;
}

describe('obfuscateStream', () => {
    it('should obfuscate uncompressed stats', async () => {
        const input = [
            'RTCStatsDump',
            JSON.stringify(['g', 'PC_0', {
                1: {address: '192.168.2.32'},
                2: {address: '1234:1234:1234:::::1234'},
            }]),
        ].join('\n') + '\n';

        const output = await obfuscate(input);
        expect(output).to.equal([
            'RTCStatsDump',
            JSON.stringify(['g', 'PC_0', {
                1: {address: '192.168.2.x'},
                2: {address: '1234:1234:1234x:x:x:x:x:x'},
            }]),
        ].join('\n') + '\n');
    });
    it('should obfuscate compressed stats', async () => {
        const input = [
            'RTCStatsDump',
            JSON.stringify(['g', 'PC_0', {
                1: {[compressStatsProperty('address')]: '192.168.2.32'},
                2: {[compressStatsProperty('address')]: '1234:1234:1234:::::1234'},
            }]),
        ].join('\n') + '\n';

        const output = await obfuscate(input);
        expect(output).to.equal([
            'RTCStatsDump',
            JSON.stringify(['g', 'PC_0', {
                1: {[compressStatsProperty('address')]: '192.168.2.x'},
                2: {[compressStatsProperty('address')]: '1234:1234:1234x:x:x:x:x:x'},
            }]),
        ].join('\n') + '\n');
    });
});
