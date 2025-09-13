// Using the AWS S3 SDK but compatible with other APIs such as DO Spaces.
import {createGzip, createGunzip} from 'node:zlib';
import {pipeline} from 'node:stream/promises';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';;

import AWS from '@aws-sdk/client-s3';
import S3Storage from '@aws-sdk/lib-storage';

export function createS3Storage(config) {
    const client = new AWS.S3Client(config);
    const Bucket = config.bucket;
    const upload = (key, filename) => {
        const upload = new S3Storage.Upload({client, params: {
            Bucket,
            Key: key,
            Body: fs.createReadStream(filename),
        }});;
        return upload.done()
            .then(response => response.Location)
    };
    const download = (filename) => {
        const command = new AWS.GetObjectCommand({
            Bucket,
            Key: filename,
        });
        return client.send(command)
    };
    return {
        put: async (key, filename) => {
            const gzip = createGzip();
            const source = fs.createReadStream(filename);
            const dest = fs.createWriteStream(filename + '.gz');
            await pipeline(source, gzip, dest);
            return upload(key + '.gz', filename + '.gz')
                .then(async (result) => {
                    await fsPromises.unlink(filename + '.gz')
                    return result;
                });
        },
        get: async (blobUrl) => {
            const gzip = createGunzip();
            const response = await download(blobUrl);
            return response.Body.pipe(gzip);
        },
    };
};

