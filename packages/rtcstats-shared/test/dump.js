import {
    detectRTCStatsDump,
    detectWebRTCInternalsDump,
    internalsToRtcstats,
    readDump,
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
        it('extracts from chromes transceiverAdded (addTrack)', async () => {
            const blob = new Blob(['RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['transceiverAdded','1',{
                    reason: 'addTrack',
                    kind: 'audio',
                    sender: {
                        track: 'trackId',
                        streams: [],
                    },
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
                label: 'trackId',
                startTime: 1,
                streams: [],
                statsId: '7',
            }]);
        });

        it('extracts from chromes transceiverAdded (addTransceiver)', async () => {
            const blob = new Blob(['RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['transceiverAdded','1',{
                    reason: 'addTransceiver',
                    kind: 'audio',
                    sender: {
                        track: 'trackId',
                        streams: [],
                    },
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
                label: 'trackId',
                startTime: 1,
                streams: [],
                statsId: '7',
            }]);
        });
        it('extracts from chromes transceiverAdded (setRemoteDescription)', async () => {
            const blob = new Blob(['RTCStatsDump\n',
                JSON.stringify({fileFormat: 3}) + '\n',
                JSON.stringify(['transceiverAdded','1',{
                    reason: 'setRemoteDescription',
                    kind: 'audio',
                    receiver: {
                        track: 'trackId',
                        streams: ['streamId'],
                    },
                },1]) + '\n',
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

    describe('internalsToRtcstats', () => {
        // Minimal slice extracted from a real Chrome webrtc-internals dump:
        // top-level UA + one getUserMedia call, one PeerConnection with a
        // string-encoded createOffer/setLocalDescription pair, and one outbound
        // stat with two timeseries samples.
        const sample = {
            cpuPerformance: 4,
            deviceMemory: 32,
            hardwareConcurrency: 24,
            timestamp: 1778229287516,
            UserAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/149.0.0.0',
            UserAgentData: {brands: [{brand: 'Chromium', version: '149'}], mobile: false, platform: 'Linux'},
            getUserMedia: [{
                request_type: 'getUserMedia',
                audio: '',
                video: '',
                timestamp: 1778229253217.358,
            }],
            PeerConnections: {
                '23-3': {
                    rtcConfiguration: '{"alwaysNegotiateDataChannels":false}',
                    updateLog: [
                        {type: 'createOffer', value: '{"offerToReceiveAudio":true}', timestamp: 1778229282213.069},
                        {type: 'setLocalDescription', value: '{"type":"offer","sdp":"v=0\\r\\n"}', timestamp: 1778229282214.603},
                    ],
                    stats: {
                        'OT01-bytesSent': {statsType: 'outbound-rtp', values: '[1839,3424]'},
                        'OT01-timestamp': {statsType: 'outbound-rtp', values: '[1778229283171.292,1778229284001.946]'},
                    },
                },
            },
        };

        it('builds the client trace from top-level fields and getUserMedia, sorted by timestamp', () => {
            const {peerConnections} = internalsToRtcstats(sample);
            expect(peerConnections['null']).to.deep.equal([
                {type: 'navigator.mediaDevices.getUserMedia', value: {audio: true, video: true}, timestamp: 1778229253217.358, extra: []},
                {type: 'create', value: {
                    cpuPerformance: 4,
                    deviceMemory: 32,
                    hardwareConcurrency: 24,
                    userAgent: sample.UserAgent,
                    userAgentData: sample.UserAgentData,
                }, timestamp: 1778229287516, extra: []},
            ]);
        });

        it('parses string-encoded updateLog values into objects', () => {
            const {peerConnections} = internalsToRtcstats(sample);
            const sld = peerConnections['23-3'].find(e => e.type === 'setLocalDescription');
            expect(sld.value).to.deep.equal({type: 'offer', sdp: 'v=0\r\n'});
        });

        it('reconstructs per-tick getStats events from the stats timeseries', () => {
            const {peerConnections} = internalsToRtcstats(sample);
            const getStats = peerConnections['23-3'].filter(e => e.type === 'getStats');
            expect(getStats).to.have.length(2);
            expect(getStats[0]).to.deep.equal({
                type: 'getStats',
                timestamp: 1778229283171.292,
                value: {OT01: {id: 'OT01', type: 'outbound-rtp', timestamp: 1778229283171.292, bytesSent: 1839}},
                extra: [],
            });
            expect(getStats[1].value.OT01.bytesSent).to.equal(3424);
        });
    });

    describe('readDump', () => {
        it('dispatches RTCStatsDump blobs to the rtcstats reader', async () => {
            const blob = new Blob(['RTCStatsDump\n' +
                JSON.stringify({fileFormat: 3}) + '\n' +
                JSON.stringify(['close', null, 1001, 1]) + '\n']);
            const result = await readDump(blob);
            expect(result.fileFormat).to.equal(3);
            expect(result.peerConnections['null'][0].type).to.equal('close');
        });

        it('dispatches webrtc-internals blobs through internalsToRtcstats', async () => {
            const blob = new Blob([JSON.stringify({
                timestamp: 1778229287516,
                PeerConnections: {'23-3': {rtcConfiguration: '{}', updateLog: [], stats: {}}},
            })]);
            const result = await readDump(blob);
            expect(Object.keys(result.peerConnections)).to.have.members(['null', '23-3']);
            expect(result.peerConnections['23-3'][0].type).to.equal('create');
            expect(result.peerConnections['23-3'][0].timestamp).to.equal(1778229287516);
        });
    });
});
