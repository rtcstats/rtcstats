import {expect} from '@esm-bundle/chai';
import sinon from 'sinon';

import {EventTrace} from '../../trace-event.js';
import {WebSocketTrace} from '../../trace-websocket.js';
import {wrapRTCPeerConnection} from '../../peerconnection.js';
import {compressMethod, readRTCStatsDump} from '@rtcstats/rtcstats-shared';

class MockWebSocket extends EventTarget {
    constructor() {
        super();
        this.readyState = WebSocket.CONNECTING;
        this.send = sinon.stub();
        this.close = sinon.stub();
    }
    async mockOpen() {
        this.readyState = WebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
        await new Promise(r => setTimeout(r, 10));
    }
}

function collect(trace) {
    const events = [];
    trace.addEventListener('rtcstats', (e) => events.push(e.detail));
    return events;
}

describe('EventTrace', () => {
    it('dispatches one event per trace call', () => {
        const trace = new EventTrace();
        const events = collect(trace);
        const before = Date.now();
        trace('getUserMedia', null, {audio: true});
        const after = Date.now();
        expect(events).to.have.length(1);
        expect(events[0].timestamp).to.be.within(before, after);
        expect(events[0].method).to.equal('getUserMedia');
        expect(events[0].pcId).to.equal(null);
        const line = JSON.parse(events[0].line);
        expect(line.slice(0, 3)).to.deep.equal([compressMethod('getUserMedia'), null, {audio: true}]);
        expect(line[3]).to.equal(events[0].timestamp);
        expect(events[0]).not.to.have.property('pc');
    });

    it('does not compress custom events', () => {
        const trace = new EventTrace();
        const events = collect(trace);
        trace(':userRating', null, 5);
        expect(JSON.parse(events[0].line).slice(0, 3)).to.deep.equal([':userRating', null, 5]);
    });

    it('allows passing a peerconnection as second argument and looks up the rtcStatsId', () => {
        const trace = new EventTrace();
        const events = collect(trace);
        const pc = new RTCPeerConnection();
        pc.__rtcStatsId = 'something for test';
        trace('method', pc);
        expect(events[0].pcId).to.equal(pc.__rtcStatsId);
        expect(JSON.parse(events[0].line)[1]).to.equal(pc.__rtcStatsId);
        pc.close();
    });

    it('stops dispatching after removeEventListener', () => {
        const trace = new EventTrace();
        const listener = sinon.stub();
        trace.addEventListener('rtcstats', listener);
        trace('something', null);
        trace.removeEventListener('rtcstats', listener);
        trace('something', null);
        expect(listener.callCount).to.equal(1);
    });

    it('sends the same create metadata as WebSocketTrace on connect', async () => {
        const socket = new MockWebSocket();
        const wsStub = sinon.stub(window, 'WebSocket').returns(socket);
        try {
            new WebSocketTrace().connect('wss://example.com');
            await socket.mockOpen();
        } finally {
            wsStub.restore();
        }
        const reference = JSON.parse(socket.send.getCall(0).args[0]);

        const trace = new EventTrace();
        const events = collect(trace);
        trace.connect();
        expect(events).to.have.length(1);
        expect(events[0].method).to.equal('create');
        expect(events[0].pcId).to.equal(null);
        const line = JSON.parse(events[0].line);
        expect(line[0]).to.equal(reference[0]);
        expect(line[2]).to.deep.equal(reference[2]);
    });

    describe('time delta', () => {
        it('ends each line with the time since the previous line', async () => {
            const trace = new EventTrace();
            const events = collect(trace);
            trace('first', null, 1);
            await new Promise(r => setTimeout(r, 20));
            trace('second', null, 2);
            const deltas = events.map((e) => JSON.parse(e.line).at(-1));
            expect(deltas[0]).to.equal(events[0].timestamp);
            expect(deltas[1]).to.equal(events[1].timestamp - events[0].timestamp);
            expect(deltas[1]).to.be.at.least(20);
        });

        it('restarts from an absolute timestamp on connect', () => {
            const trace = new EventTrace();
            const events = collect(trace);
            trace('before', null, 1);
            trace.connect();
            expect(JSON.parse(events[1].line).at(-1)).to.equal(events[1].timestamp);
        });

        it('writes lines that the dump reader reads back at their timestamps', async () => {
            const trace = new EventTrace();
            const events = collect(trace);
            trace.connect();
            trace(':first', null, {n: 1});
            await new Promise(r => setTimeout(r, 20));
            trace(':second', null, {n: 2});
            const text = 'RTCStatsDump\n' + JSON.stringify({fileFormat: 3}) + '\n' +
                events.map((e) => e.line + '\n').join('');
            const dump = await readRTCStatsDump(new Blob([text]));
            const read = dump.peerConnections.null;
            expect(read.map((e) => e.type)).to.deep.equal(['create', ':first', ':second']);
            expect(read.map((e) => e.timestamp)).to.deep.equal(events.map((e) => e.timestamp));
        });
    });

    describe('peer connection lifecycle', () => {
        it('marks the create and the first close of a peer connection', () => {
            const trace = new EventTrace();
            const events = collect(trace);
            trace('create', 'PC_0', {});
            trace('createOffer', 'PC_0', undefined);
            trace('close', 'PC_0', undefined);
            trace('close', 'PC_0', undefined);
            expect(events.map((e) => e.pc)).to.deep.equal(['created', undefined, 'closed', undefined]);
        });

        it('does not mark the session create line', () => {
            const trace = new EventTrace();
            const events = collect(trace);
            trace.connect();
            expect(events[0]).not.to.have.property('pc');
        });

        it('marks a wrapped RTCPeerConnection from creation to close', () => {
            const trace = new EventTrace();
            const events = collect(trace);
            wrapRTCPeerConnection(trace, window, {});
            const pc = new RTCPeerConnection();
            pc.close();
            const marked = events.filter((e) => e.pc);
            expect(marked.map((e) => [e.method, e.pc])).to.deep.equal([['create', 'created'], ['close', 'closed']]);
            expect(marked[0].pcId).to.equal(marked[1].pcId).and.not.equal(null);
        });
    });
});
