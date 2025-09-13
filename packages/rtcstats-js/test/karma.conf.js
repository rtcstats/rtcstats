import * as puppeteerBrowsers from '@puppeteer/browsers';
import os from 'node:os';
import path from 'node:path';

const chromeFlags = [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--headless', '--disable-gpu', '--remote-debugging-port=9222',
];

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

export default async function makeConfig(config) {
    const cacheDir = path.join(process.cwd(), 'browsers');
    const platform = puppeteerBrowsers.detectBrowserPlatform();

    const buildId = await download('firefox', process.env.BVER || 'stable',
        cacheDir, platform);
    process.env.FIREFOX_BIN = puppeteerBrowsers
        .computeExecutablePath({browser: 'firefox', buildId, cacheDir, platform});
    let browsers;
    if (process.env.BROWSER) {
        if (process.env.BROWSER === 'safari') {
            browsers = ['Safari'];
        } else if (process.env.BROWSER === 'Electron') {
            browsers = ['electron'];
        } else {
            browsers = [process.env.BROWSER];
        }
    } else if (os.platform() === 'darwin') {
        browsers = ['chrome', 'firefox', 'Safari'];
    } else if (os.platform() === 'win32') {
        browsers = ['chrome', 'firefox'];
    } else {
        browsers = ['chrome', 'firefox'];
    }
    if (browsers.includes('chrome')) {
        const buildId = await download('chrome', process.env.BVER || 'stable',
            cacheDir, platform);
        process.env.CHROME_BIN = puppeteerBrowsers
            .computeExecutablePath({browser: 'chrome', buildId, cacheDir, platform});
    }
    if (browsers.includes('firefox')) {
        const buildId = await download('firefox', process.env.BVER || 'stable',
            cacheDir, platform);
        process.env.FIREFOX_BIN = puppeteerBrowsers
            .computeExecutablePath({browser: 'firefox', buildId, cacheDir, platform});
    }
    // uses Safari Technology Preview.
    if (browsers.includes('Safari') && os.platform() === 'darwin' &&
      process.env.BVER === 'unstable' && !process.env.SAFARI_BIN) {
        process.env.SAFARI_BIN = '/Applications/Safari Technology Preview.app' +
        '/Contents/MacOS/Safari Technology Preview';
    }

    config.set({
        basePath: '..',
        files: [
            'test/getusermedia-mocha.js',
            {pattern: 'test/sink.js', type: 'module', watched: false},
            {pattern: 'test/e2e/*.js', type: 'module', watched: false},
            {pattern: '*.js', type: 'module', watched: false},
        ],
        exclude: [],
        frameworks: ['chai', 'mocha', 'webpack'],
        reporters: ['mocha', 'coverage'],
        webpack: {},
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: false,
        customLaunchers: {
            chrome: {
                base: 'Chrome',
                flags: chromeFlags
            },
            firefox: {
                base: 'Firefox',
                prefs: {
                    'media.navigator.streams.fake': true,
                    'media.navigator.permission.disabled': true,
                    'dom.user_activation.transient.timeout': -1,
                },
                flags: ['-headless'],
            },
        },
        singleRun: true,
        concurrency: Infinity,
        browsers,
        preprocessors: {
            './*.js': ['webpack', 'coverage'],
            './test/e2e/*.js': ['webpack'],
        },
    });
};
