import {Readable, Writable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

import sinon from 'sinon';

import {GeolookupStream} from '../storage/index.js';

async function lookup(input, geolookup) {
    const readStream = Readable.from(input);
    let output = '';
    const writeStream = new Writable({
        write(chunk, encoding, callback) {
            output += chunk.toString();
            callback();
        },
    });
    await pipeline(readStream, new GeolookupStream(undefined, geolookup), writeStream);
    return output;
}

describe('GeolookupStream', () => {
    const geolookup = sinon.stub().resolves({
        continent: {names: {en: 'Antarctica'}},
        country: {names: {en: 'Home of the Penguins'}},
        city: {names: {en: 'McMurdo'}},
    });
    const expectedLocation = {
        continent: 'Antarctica',
        country: 'Home of the Penguins',
        city: 'McMurdo',
    };
    it('should lookup the relay address in onicecandidate', async () => {
        const candidate = {
            candidate: 'candidate:469859642 1 UDP 58532095 8.8.8.8 53709 typ relay raddr 0.0.0.0 rport 4404 ufrag ojYK',
            sdpMid: '0',
            sdpMLineIndex: 0,
            usernameFragment: 'ojYK'
        };
        const input = [
            'RTCStatsDump',
            JSON.stringify(['onicecandidate', 'PC_0', candidate, 1]),
            JSON.stringify(['onicecandidate', 'PC_0', null, 2]),
        ].join('\n') + '\n';

        const output = await lookup(input, geolookup);
        expect(output).to.equal([
            'RTCStatsDump',
            JSON.stringify(['onicecandidate', 'PC_0', candidate, {
                rtcstatsRelayLocation: expectedLocation,
            }, 1]),
            JSON.stringify(['onicecandidate', 'PC_0', null, 2]),
        ].join('\n') + '\n');
    });

    it('should lookup the public address in onicecandidate', async () => {
        const candidate = {
            candidate: 'candidate:469859642 1 UDP 58532095 8.8.8.8 53709 typ relay raddr 127.0.0.1 rport 4404 ufrag ojYK',
            sdpMid: '0',
            sdpMLineIndex: 0,
            usernameFragment: 'ojYK'
        };
        const input = [
            'RTCStatsDump',
            JSON.stringify(['onicecandidate', 'PC_0', candidate, 1]),
            JSON.stringify(['onicecandidate', 'PC_0', null, 2]),
        ].join('\n') + '\n';

        const output = await lookup(input, geolookup);
        expect(output).to.equal([
            'RTCStatsDump',
            JSON.stringify(['onicecandidate', 'PC_0', candidate, {
                rtcstatsRelayLocation: expectedLocation,
                rtcstatsLocation: expectedLocation,
            }, 1]),
            JSON.stringify(['onicecandidate', 'PC_0', null, 2]),
        ].join('\n') + '\n');
    });
});
