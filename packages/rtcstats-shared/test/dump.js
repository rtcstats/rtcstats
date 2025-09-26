import {
    detectRTCStatsDump,
    detectWebRTCInternalsDump,
    readRTCStatsDump,
} from '../dump.js';

describe('RTCStats dump', () => {
    describe('format detection', () => {
        it('detects the RTCStats format', async () => {
            const blob = new Blob(['RTCStatsDump\n']);
            expect(await detectRTCStatsDump(blob)).to.equal(true);
            expect(await detectWebRTCInternalsDump(blob)).to.equal(false);
        });
        it('detects the webrtc-internals format', async () => {
            const blob = new Blob(['{}']);
            expect(await detectRTCStatsDump(blob)).to.equal(false);
            expect(await detectWebRTCInternalsDump(blob)).to.equal(true);
        });
    });

    describe('reading', () => {
        it('reads a minimal sample dump', async () => {
            const blob = new Blob(['RTCStatsDump\n' +
                                  JSON.stringify({fileFormat: 3}) + '\n' +
                                  JSON.stringify(['close',null,1001,1]) + '\n'
            ]);
            const result = await readRTCStatsDump(blob);
            expect(result).to.deep.equal({
                fileFormat: 3,
                peerConnections: {null: [{
                    extra: [],
                    time: new Date(1),
                    timestamp: 1,
                    type: 'close',
                    value: 1001
                }]},
                eventSizes: {},
            });
        });

        it('ignores other formats', async () => {
            const blob = new Blob(['Not an RTCStatsDump\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.equal(undefined);
        });

        it('ignores non-JSON on the second line', async () => {
            const blob = new Blob(['RTCStatsDump\nabc\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.equal(undefined);
        });

        it('ignores non-objects on the second line', async () => {
            const blob = new Blob(['RTCStatsDump\n[]\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.equal(undefined);
        });

        it('ignores empty lines', async () => {
            const blob = new Blob(['RTCStatsDump\n' + JSON.stringify({fileFormat: 3}) + '\n\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.deep.equal({
                fileFormat: 3,
                peerConnections: {},
                eventSizes: {},
            });
        });
        it('ignores non-JSON after the second line', async () => {
            const blob = new Blob(['RTCStatsDump\n{}\nabc\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.equal(undefined);
        });

        it('ignores non-arrays after the second line', async () => {
            const blob = new Blob(['RTCStatsDump\n{\"fileFormat\": 3}\n"abc"\n']);
            const result = await readRTCStatsDump(blob);
            expect(result).to.deep.equal({
                fileFormat: 3,
                peerConnections: {},
                eventSizes: {},
            });
        });

        it('reads a dump with getStats', async () => {
            const blob = new Blob(['RTCStatsDump\n' +
                                  JSON.stringify({fileFormat: 3}) + '\n' +
                                  JSON.stringify(['create','1',{},1]) + '\n' +
                                  JSON.stringify(['getStats','1',{},1]) + '\n' +
                                  JSON.stringify(['close','1',1001,1]) + '\n'
            ]);
            const result = await readRTCStatsDump(blob);
            expect(result).to.deep.equal({
                fileFormat: 3,
                peerConnections: {1: [{
                    extra: [],
                    time: new Date(1),
                    timestamp: 1,
                    type: 'create',
                    value: {},
                }, {
                    extra: [],
                    time: new Date(2),
                    timestamp: 2,
                    type: 'getStats',
                    value: {},
                }, {
                    extra: [],
                    time: new Date(3),
                    timestamp: 3,
                    type: 'close',
                    value: 1001,
                }]},
                eventSizes: {1: [{
                    method: 'create', x: 1, y: 19,
                }, {
                    method: 'getStats', x: 2, y: 21,
                }, {
                    method: 'close', x: 3, y: 20,
                }]},
            });
        });
    });
});
