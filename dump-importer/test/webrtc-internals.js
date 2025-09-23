import {TestHTTPServer, buildDriver, webdriver, loadDump} from './utils.cjs';

let driver;
let server;
const port = 4404;
describe('dump-importer with webrtc-internals', () => {
    before(async () => {
        server = new TestHTTPServer(port);
        driver = await buildDriver();
    });
    after(() => {
        driver.quit();
        server.close();
    });

    it('imports a getusermedia-only gzipped dump', async () => {
        await driver.get('http://localhost:' + port);
        await loadDump(driver, './test/data/internals/gumonly.gz');
        await driver.wait(() => {
            return driver.executeScript(() => window.rtcStatsDumpImporterSuccess);
        }, 1000);
    });
});

