import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

// Resolve the repo's config/ directory regardless of where the script is run from.
process.env.NODE_CONFIG_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)), '..', 'config');

const {default: config} = await import('config');
const {generateAuthToken} = await import('@rtcstats/rtcstats-server/utils.js');

const {values} = parseArgs({
    options: {
        lifetime: {type: 'string', short: 'l', default: '600'},
        url: {type: 'string', short: 'u'},
    },
});

const lifetime = Number.parseInt(values.lifetime, 10);
if (!Number.isFinite(lifetime) || lifetime <= 0) {
    console.error(`Invalid --lifetime: ${values.lifetime}`);
    process.exit(1);
}
if (!config.authorization?.jwtSecret) {
    console.error('authorization.jwtSecret is not set in the current config.');
    process.exit(1);
}

const token = await generateAuthToken({}, config.authorization.jwtSecret, lifetime);

if (values.url) {
    console.log(values.url + '/?rtcstats-token=' + encodeURIComponent(token));
} else {
    console.log(token);
}
