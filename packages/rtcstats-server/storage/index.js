import {createS3Storage} from './aws-s3.js';
import {createNoStorage} from './no-storage.js';

export function createStorage(config) {
    if (!(config.s3 && config.s3.bucket)) {
        return createNoStorage();
    }
    return createS3Storage(config.s3);
}
