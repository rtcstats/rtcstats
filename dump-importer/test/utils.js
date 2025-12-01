import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import * as webdriver from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';

async function buildDriver() {
    const chromeOptions = new chrome.Options()
        .addArguments(
            'headless=new',
            'no-sandbox',
            'disable-dev-shm-usage',
            'use-fake-ui-for-media-stream',
            'use-fake-device-for-media-stream'
        );

    return new webdriver.Builder()
        .setChromeOptions(chromeOptions)
        .build();
}

async function loadDump(driver, dumpPath) {
    const input = await driver.findElement(webdriver.By.id('import'));
    const dataPath = path.resolve('./test/data/internals/gumonly.gz');
    return input.sendKeys(path.resolve(dumpPath));
}

class TestHTTPServer {
    constructor(port) {
        this.server = new http.Server({}, () => { })
            .on('request', this.handleHttpRequest.bind(this))
            .listen(port);
    }
    close() {
        this.server.close();
    }

    handleHttpRequest(request, response) {
        if (request.url.startsWith('/packages/rtcstats-') && request.url.endsWith('.js')) {
            fs.readFile('..' + request.url, (error, content) => {
                response.writeHead(200, {'Content-Type': 'text/javascript'});
                response.end(content, 'utf-8');
            });
        } else if (request.url.endsWith('.js')) {
            fs.readFile('./' + request.url, (error, content) => {
                response.writeHead(200, {'Content-Type': 'text/javascript'});
                response.end(content, 'utf-8');
            });
        } else if (request.url === '/') {
            fs.readFile('./index.html', (error, content) => {
                response.writeHead(200, {'Content-Type': 'text/html'});
                response.end(content, 'utf-8');
            });
        } else {
            response.writeHead(404);
            response.end();
        }
    }
}

export {
    buildDriver,
    loadDump,
    webdriver,
    TestHTTPServer,
};
