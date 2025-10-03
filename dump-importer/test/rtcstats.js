import {TestHTTPServer, buildDriver, webdriver, loadDump} from './utils.cjs';

let driver;
let server;
const port = 4404;
describe('dump-importer with rtcstats', () => {
    before(async () => {
        server = new TestHTTPServer(port);
        driver = await buildDriver();
    });
    after(() => {
        if (driver) driver.quit();
        server.close();
    });

    it('imports a getusermedia-only plain dump', async () => {
        await driver.get('http://localhost:' + port);
        await loadDump(driver, './test/data/rtcstats/gumonly.jsonl');
        await driver.wait(() => {
            return driver.executeScript(() => window.rtcStatsDumpImporterSuccess);
        }, 1000);
    });
});

