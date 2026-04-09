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
            if (decompressMethod(data[0]) === 'onicecandidate' && data[2] && typeof(data[2]) === 'object') {
                const candidate = SDPUtils.parseCandidate(data[2].candidate);
                if (candidate && candidate.type === 'relay') {
                    const result = {};
                    if (candidate.address) {
                        const relayLookup = await this._lookup(candidate.address);
                        if (relayLookup) {
                            result.rtcstatsRelayLocation = { // English names of contintent, country and city.
                                continent: relayLookup.continent?.names['en'],
                                country: relayLookup.country?.names['en'],
                                city: relayLookup.city?.names['en'],
                            };
                        }
                        if (candidate.relatedAddress && candidate.relatedAddress !== '0.0.0.0') {
                            const srflxLookup = await this._lookup(candidate.relatedAddress);
                            if (srflxLookup) {
                                result.rtcstatsLocation = { // English names of contintent, country and city.
                                    continent: srflxLookup.continent?.names['en'],
                                    country: srflxLookup.country?.names['en'],
                                    city: srflxLookup.city?.names['en'],
                                };
                            }
                        }
                        if (result.rtcstatsRelayLocation || result.rtcstatsLocation) {
                            data.splice(3, 0, result);
                        }
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
