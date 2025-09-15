import * as puppeteerBrowsers from '@puppeteer/browsers';
import { chromeLauncher } from '@web/test-runner';
import path from 'node:path';

async function download(browser, version, cacheDir, platform) {
    const buildId = await puppeteerBrowsers
        .resolveBuildId(browser, platform, version);
    await puppeteerBrowsers.install({
        browser,
        buildId,
        cacheDir,
        platform
    });
    return buildId;
}

const cacheDir = path.join(process.cwd(), 'browsers');
const platform = puppeteerBrowsers.detectBrowserPlatform();
const buildId = await download('chrome', process.env.BVER || 'stable',
    cacheDir, platform);

export default {
    files: ['test/e2e/*.js'],
    nodeResolve: true,
    coverage: true,
    browsers: [
        chromeLauncher({
            launchOptions: {
                executablePath: puppeteerBrowsers
                    .computeExecutablePath({browser: 'chrome', buildId, cacheDir, platform}),
                args: [
                    '--use-fake-device-for-media-stream',
                    '--use-fake-ui-for-media-stream',
                ],
            },
        }),
    ],
    rootDir: '../..',
};
