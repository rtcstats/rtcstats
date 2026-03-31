import {createRtcStatsUploader} from '../storage/rtcstats-com.js';

describe('Storage', () => {
    describe('RTCStats integration', () => {
        let fetchArgs;
        beforeEach(() => {
            fetchArgs = [];
        });
        const fetchMock = (...args) => {
            fetchArgs.push(args);
            return {
                ok: true,
            };
        };
        const testFile = Buffer.from('hello world', 'ascii');
        testFile.size = testFile.length;
        testFile.name = 'testname';

        it('does not create an uploader if endpoint is undefined', () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: undefined,
            });
            expect(uploader).to.equal(undefined);
        });
        it('does not create an uploader if token is undefined', () => {
            const uploader = createRtcStatsUploader({
                token: undefined,
                endpoint: 'http://example.com/',
            });
            expect(uploader).to.equal(undefined);
        });
        it('does create an uploader function', () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
            });
            expect(uploader).to.be.a('function');
        });
        it('does not upload if the random sampling percentage is set to 0', async () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
                randomPercentage: 0,
            });
            await uploader(testFile);
            expect(fetchArgs).to.have.length(0);
        });
        it('splits the data for uploading', async () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
            });
            await uploader(testFile);
            expect(fetchArgs).to.have.length(2);
        });
    });
});
