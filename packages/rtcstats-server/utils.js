import fs from 'node:fs';
import path from 'node:path';

import jwt from 'jsonwebtoken';

// Synchronous setup for work and upload directories.
export function setupDirectory(config, directoryName) {
    try {
        if (fs.existsSync(directoryName)) {
            if (config.server.deleteAtStart) {
                fs.readdirSync(directoryName).forEach(fileName => {
                    try {
                        console.log(`Removing file ${path.join(directoryName, fileName)}`);
                        fs.unlinkSync(path.join(directoryName, fileName));
                    } catch (e) {
                        console.error(`Error while unlinking file ${fileName} - ${e.message}`);
                    }
                });
            }
        } else {
            console.log(`Creating working dir ${directoryName}`);
            fs.mkdirSync(directoryName);
        }
    } catch (e) {
        console.error(`Error while accessing working dir ${directoryName} - ${e.message}`);
    }
}

// Generate a rtcstats JWT token.
export async function generateAuthToken(rtcStatsData, secret) {
    return new Promise((resolve, reject) => {
        jwt.sign({
            rtcStats: rtcStatsData,
        }, secret, {expiresIn: 60/* seconds */}, (err, token) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(token);
        });
    });
}

