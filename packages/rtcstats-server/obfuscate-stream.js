// Applies IP address obfuscation to a dump file.
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';
import { decompressMethod } from '@rtcstats/rtcstats-shared';
import { obfuscateAddress } from '@rtcstats/rtcstats-shared/address-obfuscator.js';

export class ObfuscateStream extends Transform {
  constructor (options) {
    super(options);
    this._decoder = new StringDecoder('utf-8');
    this._last = '';
  }

  _transform (chunk, encoding, callback) {
    let data = this._last + this._decoder.write(chunk);
    const lines = data.split('\n');
    this._last = lines.pop();

    for (const line of lines) {
      this.processLine(line);
    }
    callback();
  }

  _flush (callback) {
    this.processLine(this._last + this._decoder.end());
    callback();
  }

  processLine (line) {
    if (!line) {
      return;
    }
    if (line.startsWith('RTCStatsDump')) {
      this.push(line + '\n');
      return;
    }
    try {
      const data = JSON.parse(line);
      obfuscateAddress(decompressMethod(data[0]), data);
      this.push(JSON.stringify(data) + '\n');
    } catch (e) {
      console.error(`Error while processing: ${e} - ${line}`);
      this.push(line + '\n');
    }
  }
}
