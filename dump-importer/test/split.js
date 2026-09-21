import {expect} from 'chai';

import {readRTCStatsDump} from '@rtcstats/rtcstats-shared';

import {splitDump} from '../split-dump.js';

const RTCSTATS_DUMP = [
    'RTCStatsDump',
    '{"fileFormat":3}',
    '["create",null,{"deviceMemory":8},1000000]',
    '["create","10-0",{},"https://a.example/page",10]',
    '["create","20-0",{},"https://b.example/page",5]',
    '["onsignalingstatechange","10-0","have-local-offer",5]',
    '["navigator.mediaDevices.getUserMedia","20-1",{"audio":true},"gum-0","https://b.example/other",5]',
    '["close","10-0",null,5]',
    ''
].join('\n');

const INTERNALS_DUMP = JSON.stringify({
    getUserMedia: [
        {pid: 10, request_id: 0, request_type: 'getUserMedia', origin: 'https://a.example', audio: ''},
        {pid: 10, request_id: 0, request_type: 'getUserMedia', stream_id: 'stream'},
        {pid: 20, request_id: 0, request_type: 'getUserMedia', origin: 'https://b.example', video: ''},
    ],
    PeerConnections: {
        '10-1': {url: 'https://a.example/page', updateLog: [{type: 'create'}]},
        '20-1': {url: 'https://b.example/page', updateLog: [{type: 'create'}]},
    },
    UserAgent: 'test',
});

describe('dump splitter', () => {
    describe('rtcstats dumps', () => {
        it('groups peer connections by origin', async () => {
            const {origins} = await splitDump(new Blob([RTCSTATS_DUMP]));
            expect(origins.map(origin => origin.origin))
                .to.deep.equal(['https://a.example', 'https://b.example']);
            expect(origins[0].connections).to.equal(1);
            expect(origins[0].events).to.equal(3);
            expect(origins[1].connections).to.equal(1);
            expect(origins[1].events).to.equal(2);
            // 20-1 only has a getUserMedia call and is not listed as a connection.
            expect(origins[1].traces.map(trace => trace.id)).to.deep.equal(['20-0']);
        });

        it('keeps the dump unchanged when all origins are selected', async () => {
            const dump = await splitDump(new Blob([RTCSTATS_DUMP]));
            const blob = dump.build(dump.origins.map(origin => origin.origin));
            expect(await blob.text()).to.equal(RTCSTATS_DUMP);
        });

        it('drops the events of origins that are not selected', async () => {
            const dump = await splitDump(new Blob([RTCSTATS_DUMP]));
            const lines = (await dump.build(['https://a.example']).text()).split('\n');
            expect(lines.filter(line => line.includes('b.example'))).to.have.length(0);
            expect(lines.filter(line => line.includes('10-0'))).to.have.length(3);
        });

        it('keeps events which have no origin', async () => {
            const dump = await splitDump(new Blob([RTCSTATS_DUMP]));
            const text = await dump.build(['https://b.example']).text();
            expect(text).to.contain('"deviceMemory":8');
        });

        it('re-anchors the timestamps of the remaining events', async () => {
            const dump = await splitDump(new Blob([RTCSTATS_DUMP]));
            const blob = dump.build(['https://a.example']);
            const {peerConnections} = await readRTCStatsDump(blob);
            expect(peerConnections['null'].map(event => event.timestamp))
                .to.deep.equal([1000000]);
            expect(peerConnections['10-0'].map(event => event.timestamp))
                .to.deep.equal([1000010, 1000020, 1000030]);
        });

        it('groups local pages by their url, which have no origin of their own', async () => {
            const dump = await splitDump(new Blob([[
                'RTCStatsDump',
                '{"fileFormat":3}',
                '["create","10-0",{},"file:///home/someone/one.html",1000000]',
                '["create","20-0",{},"file:///home/someone/two.html",5]',
                ''
            ].join('\n')]));
            expect(dump.origins.map(origin => origin.origin)).to.deep.equal([
                'file:///home/someone/one.html',
                'file:///home/someone/two.html',
            ]);
        });
    });

    describe('webrtc-internals dumps', () => {
        it('groups peer connections and getUserMedia calls by origin', async () => {
            const {origins} = await splitDump(new Blob([INTERNALS_DUMP]));
            expect(origins.map(origin => origin.origin))
                .to.deep.equal(['https://a.example', 'https://b.example']);
            // Two getUserMedia entries belonging to the same request plus the connection.
            expect(origins[0].events).to.equal(3);
            expect(origins[0].connections).to.equal(1);
        });

        it('drops peer connections and getUserMedia calls of unselected origins', async () => {
            const dump = await splitDump(new Blob([INTERNALS_DUMP]));
            const json = JSON.parse(await dump.build(['https://a.example']).text());
            expect(Object.keys(json.PeerConnections)).to.deep.equal(['10-1']);
            expect(json.getUserMedia).to.have.length(2);
            expect(json.UserAgent).to.equal('test');
        });
    });

    it('returns nothing for an unrecognized format', async () => {
        expect(await splitDump(new Blob(['not a dump']))).to.equal(undefined);
    });
});
