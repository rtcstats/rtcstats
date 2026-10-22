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
                json: () => {},
            };
        };
        // Minimal fs.FileHandle stand-in backed by a Buffer.
        const fileHandleFor = (contents) => ({
            reads: [],
            stat() {
                return Promise.resolve({size: contents.length});
            },
            read(buffer, offset, length, position) {
                this.reads.push([position, position + length]);
                const bytesRead = contents.copy(buffer, offset, position, position + length);
                return Promise.resolve({bytesRead});
            },
        });
        const testFile = fileHandleFor(Buffer.from('hello world', 'ascii'));

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
            await uploader(testFile, 'testname');
            expect(fetchArgs).to.have.length(0);
        });
        it('uploads when the random value is below the sampling percentage', async () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
                random: () => 0.3,
                randomPercentage: 0.5,
            });
            await uploader(testFile, 'testname');
            expect(fetchArgs).to.have.length(2);
        });
        it('does not upload when the random value is above the sampling percentage', async () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
                random: () => 0.7,
                randomPercentage: 0.5,
            });
            await uploader(testFile, 'testname');
            expect(fetchArgs).to.have.length(0);
        });
        it('splits the data for uploading', async () => {
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
            });
            await uploader(testFile, 'testname');
            expect(fetchArgs).to.have.length(2);
        });
        describe('chunk retries', () => {
            const fetchSequence = (...results) => (...args) => {
                fetchArgs.push(args);
                const result = results.length > 1 ? results.shift() : results[0];
                if (result instanceof Error) {
                    return Promise.reject(result);
                }
                return {ok: result === 200, status: result, json: () => ({})};
            };
            const rejection = (promise) => promise.then(() => {
                throw new Error('expected rejection');
            }, e => e);
            const createUploader = (fetch) => createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch,
                retryDelays: [0, 0, 0],
            });

            it('retries a chunk after a 5xx response', async () => {
                await createUploader(fetchSequence(502, 200))(testFile, 'testname');
                expect(fetchArgs).to.have.length(3);
                expect(fetchArgs[0][1].body).to.equal(fetchArgs[1][1].body);
            });
            it('retries a chunk after a 429 response', async () => {
                await createUploader(fetchSequence(429, 200))(testFile, 'testname');
                expect(fetchArgs).to.have.length(3);
            });
            it('retries a chunk after a network error', async () => {
                await createUploader(fetchSequence(new TypeError('fetch failed'), 200))(testFile, 'testname');
                expect(fetchArgs).to.have.length(3);
            });
            it('does not retry a chunk after a 4xx response', async () => {
                const uploader = createUploader(fetchSequence(401));
                expect((await rejection(uploader(testFile, 'testname'))).message).to.equal('Chunk upload failed');
                expect(fetchArgs).to.have.length(1);
            });
            it('gives up after the last retry', async () => {
                const uploader = createUploader(fetchSequence(503));
                expect((await rejection(uploader(testFile, 'testname'))).message).to.equal('Chunk upload failed');
                expect(fetchArgs).to.have.length(4);
            });
            it('rethrows the network error after the last retry', async () => {
                const uploader = createUploader(fetchSequence(new TypeError('fetch failed')));
                expect((await rejection(uploader(testFile, 'testname'))).message).to.equal('fetch failed');
                expect(fetchArgs).to.have.length(4);
            });
        });
        it('reads the file one chunk at a time instead of buffering it whole', async () => {
            const chunkSize = 1024 * 1024;
            const handle = fileHandleFor(Buffer.alloc(chunkSize * 2 + 10));
            const uploader = createRtcStatsUploader({
                token: 'abc',
                endpoint: 'http://example.com/',
                fetch: fetchMock,
            });
            await uploader(handle, 'testname');
            // Three chunk uploads plus the assemble call.
            expect(fetchArgs).to.have.length(4);
            expect(handle.reads).to.deep.equal([
                [0, chunkSize],
                [chunkSize, chunkSize * 2],
                [chunkSize * 2, chunkSize * 2 + 10],
            ]);
        });
    });
});
