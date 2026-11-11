import {Transform, TransformOptions} from 'node:stream';

export function createStorage(config: object): any;
export function createDatabase(config: object): any;

export class ObfuscateStream extends Transform {
    constructor(options?: TransformOptions);
}

export class GeolookupStream extends Transform {
    constructor(options: TransformOptions | undefined, lookup: (address: string) => Promise<any>);
}
