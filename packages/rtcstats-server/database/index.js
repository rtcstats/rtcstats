import {createPostgres} from './postgres.js';
import {createNoDatabase} from './no-database.js';

export function createDatabase(config) {
    if (!(config.postgres && config.postgres.connectionString)) {
        return createNoDatabase();
    }
    return createPostgres(config.postgres);
}
