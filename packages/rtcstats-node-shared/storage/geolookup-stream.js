// Geolookup of an IP address of TURN servers from a dump file.
// Should be applied before obfuscation.
import {Transform} from 'node:stream';
import {StringDecoder} from 'node:string_decoder';

import SDPUtils from 'sdp';
import {decompressMethod} from '@rtcstats/rtcstats-shared';

export class GeolookupStream extends Transform {
    constructor(options, lookup) {
        super(options);
        this._decoder = new StringDecoder('utf-8');
        this._last = '';
        this._lookup = lookup;
    }

    async _transform(chunk, encoding, callback) {
        let data = this._last + this._decoder.write(chunk);
        const lines = data.split('\n');
        this._last = lines.pop();

        for (const line of lines) {
            await this.processLine(line);
        }
        callback();
    }

    _flush(callback) {
        this.processLine(this._last + this._decoder.end())
            .then(() => callback());
    }

    async processLine(line) {
        if (!line) {
            return;
        }
        if (line.startsWith('RTCStatsDump')) {
            this.push(line + '\n');
            return;
        }
        try {
            const data = JSON.parse(line);
            const method = decompressMethod(data[0]);
            if (['onicecandidate', 'addIceCandidate'].includes(method) && data[2] && typeof(data[2]) === 'object') {
                const candidate = SDPUtils.parseCandidate(data[2].candidate);
                if (candidate && candidate.address) {
                    const result = {};
                    const geoLookup = await this._lookup(candidate.address);
                    if (geoLookup) {
                        result.rtcstatsLocation = { // English names of continent, country and city.
                            continent: geoLookup.continent?.names['en'],
                            country: geoLookup.country?.names['en'],
                            city: geoLookup.city?.names['en'],
                        };
                    }
                    if (result.rtcstatsLocation) {
                        data.splice(3, 0, result);
                    }
                }
            }
            this.push(JSON.stringify(data) + '\n');
        } catch (e) {
            console.error(`Error while processing: ${e} - ${line}`);
            this.push(line + '\n');
        }
    }
}
