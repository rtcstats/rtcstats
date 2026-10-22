import {extractMetadata} from '../rtcstats-websocket.js';

describe('extractMetadata', () => {
    const upgradeRequest = (url) => ({
        url,
        headers: {origin: 'https://example.com'},
        connection: {remoteAddress: '127.0.0.1'},
    });

    it('obfuscates the authorization token in the url', async () => {
        const metadata = await extractMetadata(upgradeRequest('/?rtcstats-token=abc.def.ghi'));
        expect(metadata.url).to.equal('/?rtcstats-token=obfuscated');
    });

    it('keeps the other query parameters', async () => {
        const metadata = await extractMetadata(upgradeRequest('/collect?rtcstats-token=abc&client=1'));
        expect(metadata.url).to.equal('/collect?rtcstats-token=obfuscated&client=1');
    });

    it('keeps a url without a token', async () => {
        const metadata = await extractMetadata(upgradeRequest('/collect?client=1'));
        expect(metadata.url).to.equal('/collect?client=1');
    });

    it('trims the addresses from x-forwarded-for', async () => {
        const request = upgradeRequest('/');
        request.headers['x-forwarded-for'] = '1.2.3.4, 10.0.0.1,127.0.0.1';
        const metadata = await extractMetadata(request, {obfuscateIpAddresses: true});
        expect(metadata.remoteAddresses).to.deep.equal(['1.2.3.x', '10.0.0.x', '127.0.0.1']);
    });
});
