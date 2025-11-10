import {TestHTTPServer, buildDriver, webdriver, loadDump} from './utils.js';

describe('dump-importer', () => {
    let driver;
    let server;
    const port = 4404;

    before(async () => {
        server = new TestHTTPServer(port);
        driver = await buildDriver();
    });
    after(async () => {
        if (driver) await driver.quit();
        server.close();
    });
    describe('dump-importer with rtcstats', () => {

        it('imports a getusermedia-only plain dump', async () => {
            await driver.get('http://localhost:' + port);
            await loadDump(driver, './test/data/rtcstats/gumonly.jsonl');
            await driver.wait(() => {
                return driver.executeScript(() => window.rtcStatsDumpImporterSuccess);
            }, 1000);
        });
    });

    describe('dump-importer with webrtc-internals', () => {
        it('imports a getusermedia-only gzipped dump', async () => {
            await driver.get('http://localhost:' + port);
            await loadDump(driver, './test/data/internals/gumonly.gz');
            await driver.wait(() => {
                return driver.executeScript(() => window.rtcStatsDumpImporterSuccess);
            }, 1000);
        });
    });
});
