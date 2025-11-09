import {
    detectRTCStatsDump,
    detectWebRTCInternalsDump,
    readRTCStatsDump,
    readWebRTCInternalsDump,
    extractTracks,
} from '../dump.js';

describe('RTCStats dump', () => {
    describe('format detection', () => {
        it('detects the RTCStats format', async () => {
            const blob = new Blob(['RTCStatsDump\n']);
            expect(await detectRTCStatsDump(blob)).to.equal(true);
            expect(await detectWebRTCInternalsDump(blob)).to.equal(false);
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
                eventSizes: {
                    null: [{
                        method: 'close',
                        x: 1,
                        y: 21,
                    }],
                },
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

        it('reads a dump with compressed sdp', async () => {
            const blob = new Blob(['RTCStatsDump\n' +
                JSON.stringify({fileFormat: 3}) + '\n' +
                JSON.stringify(['create','1',{},1]) + '\n' +
                JSON.stringify(['createOfferOnSuccess','1',{type: 'offer', sdp: 'v=0\r\n'},1]) + '\n' +
                JSON.stringify(['setLocalDescription','1',{type: 'offer', sdp: 'v=\r\n'},1]) + '\n' +
                JSON.stringify(['createOfferOnSuccess','1',{type: 'offer', sdp: 'v=\r\n'},1]) + '\n' +
                JSON.stringify(['setLocalDescription','1',null,1]) + '\n'
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
                    type: 'createOfferOnSuccess',
                    value: {type: 'offer', sdp: 'v=0\r\n'},
                }, {
                    extra: [],
                    time: new Date(3),
                    timestamp: 3,
                    type: 'setLocalDescription',
                    value: {type: 'offer', sdp: 'v=0\r\n'},
                }, {
                    extra: [],
                    time: new Date(4),
                    timestamp: 4,
                    type: 'createOfferOnSuccess',
                    value: {type: 'offer', sdp: 'v=0\r\n'},
                }, {
                    extra: [],
                    time: new Date(5),
                    timestamp: 5,
                    type: 'setLocalDescription',
                    value: null,
                }]},
                eventSizes: {1: [{
                    method: 'create', x: 1, y: 19,
                }, {
                    method: 'createOfferOnSuccess', x: 2, y: 63,
                }, {
                    method: 'setLocalDescription', x: 3, y: 61,
                }, {
                    method: 'createOfferOnSuccess', x: 4, y: 62,
                }, {
                    method: 'setLocalDescription', x: 5, y: 34,
                }]},
            });
        });
    });

    describe('extractTracks', () => {
        it('extracts from addTrack', async () => {
            const blob = new Blob([
                'RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['addTrack','1',['audio','trackId','trackLabel','streamId'],1]) + '\n',
                JSON.stringify(['getStats','1',{
                    7: {type:'outbound-rtp', mediaSourceId: '8'},
                    8: {type: 'media-source', trackIdentifier: 'trackId'}
                },1]) + '\n',
            ]);
            const result = await readRTCStatsDump(blob);
            const trackInfo = await extractTracks(result.peerConnections['1']);
            expect(trackInfo).to.deep.equal([{
                direction: 'outbound',
                id: 'trackId',
                kind: 'audio',
                label: 'trackLabel',
                startTime: 1,
                statsId: '7',
                streams: [ 'streamId' ],
            }]);
        });
        it('extracts from addTransceiver', async () => {
            const blob = new Blob([
                'RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['addTransceiver','1',[['audio','trackId','trackLabel'],{streams:['streamId']}],1]) + '\n',
                JSON.stringify(['getStats','1',{
                    7: {type:'outbound-rtp', mediaSourceId: '8'},
                    8: {type: 'media-source', trackIdentifier: 'trackId'}
                },1]) + '\n',
                JSON.stringify(['getStats','1',{
                    7: {type:'outbound-rtp', mediaSourceId: '8'},
                    8: {type: 'media-source', trackIdentifier: 'trackId'}
                },1]) + '\n',
            ]);
            const result = await readRTCStatsDump(blob);
            const trackInfo = await extractTracks(result.peerConnections['1']);
            expect(trackInfo).to.deep.equal([{
                direction: 'outbound',
                id: 'trackId',
                kind: 'audio',
                label: 'trackLabel',
                startTime: 1,
                statsId: '7',
                streams: [ 'streamId' ],
            }]);
        });
        it('extracts from addTransceiver and replaceTrack', async () => {
            const blob = new Blob(['RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['addTransceiver','1',['audio'],1]) + '\n',
                JSON.stringify(['getStats','1',{
                    7: {type:'outbound-rtp'},
                },1]) + '\n',
                JSON.stringify(['replaceTrack','1',[null, ['audio', 'trackId', 'trackLabel']],1]) + '\n',
            ]);
            const result = await readRTCStatsDump(blob);
            const trackInfo = await extractTracks(result.peerConnections['1']);
            expect(trackInfo).to.deep.equal([{
                direction: 'outbound',
                id: 'trackId',
                kind: 'audio',
                label: 'trackLabel',
                startTime: 3,
                streams: [],
                // statsId: '7',
            }]);
        });
        it('extracts from ontrack', async () => {
            const blob = new Blob([
                'RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['ontrack','1',['audio','trackId','trackId','streamId'],1]) + '\n',
                JSON.stringify(['getStats','1',{
                    7: {type:'inbound-rtp', trackIdentifier: 'trackId'},
                },1]) + '\n',
            ]);
            const result = await readRTCStatsDump(blob);
            const trackInfo = await extractTracks(result.peerConnections['1']);
            expect(trackInfo).to.deep.equal([{
                direction: 'inbound',
                id: 'trackId',
                kind: 'audio',
                label: 'trackId',
                startTime: 1,
                statsId: '7',
                streams: [ 'streamId' ],
            }]);
        });
    });
});

describe('webrtc-internals dump', () => {
    it('detects the webrtc-internals format', async () => {
        const blob = new Blob(['{}']);
        expect(await detectRTCStatsDump(blob)).to.equal(false);
        expect(await detectWebRTCInternalsDump(blob)).to.equal(true);
    });
    it('reads a minimal sample dump', async () => {
        const blob = new Blob(['{}']);
        const result = await readWebRTCInternalsDump(blob);
        expect(result).to.deep.equal({});
    });
});
