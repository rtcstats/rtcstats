import {expect} from '@esm-bundle/chai';
import sinon from 'sinon';

import {WebSocketTrace} from '../../trace-websocket.js';
import {compressMethod} from '@rtcstats/rtcstats-shared';

class MockWebSocket extends EventTarget{
    constructor(...args) {
        super();
        this.readyState = WebSocket.CONNECTING;
        this.send = sinon.stub();
        this.close = sinon.stub();
    }
    async mockOpen() {
        this.readyState = WebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
        // Flush any events.
        await new Promise(r => setTimeout(r, 10));
    }
    async mockRefuse() {
        this.readyState = WebSocket.CLOSED;
        this.dispatchEvent(new Event('error'));
        // Flush any events.
        await new Promise(r => setTimeout(r, 10));
    }
}

const RELOAD_COUNT_KEY = 'rtcstatsReloadCount';
const TEST_WSURL = 'wss://example.com:8080';
describe('WebSocketTrace', () => {
    let wsStub;
    let wsInstance;
    beforeEach(() => {
        wsStub = sinon.stub(window, 'WebSocket');
        wsInstance = new MockWebSocket();
        wsStub.withArgs(TEST_WSURL).returns(wsInstance);
    });
    afterEach(() =>{
        wsStub.restore();
    });

    it('buffers before connect', async () => {
        const trace = new WebSocketTrace();
        trace('something', null);
        trace.connect(TEST_WSURL);
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.at.least(2);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[0]).to.equal('something');
        expect(JSON.parse(wsInstance.send.getCall(0).args)[1]).to.equal(null);
    });

    it('buffers while connecting', async () => {
        const trace = new WebSocketTrace();
        trace.connect(TEST_WSURL);
        trace('something', null);
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.at.least(3);
        expect(JSON.parse(wsInstance.send.getCall(1).args)[0]).to.equal('something');
        expect(JSON.parse(wsInstance.send.getCall(1).args)[1]).to.equal(null);
    });

    it('sends metadata and ws connection time on connect', async () => {
        const trace = new WebSocketTrace();
        trace.connect(TEST_WSURL);
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.be.at.least(2);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[1]).to.equal(null);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[2]).to.be.an('object');
    });

    it('sends metadata and ws connection time on reconnect', async () => {
        const trace = new WebSocketTrace();
        trace.connect(TEST_WSURL);
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.be.at.least(2);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[0]).to.equal(compressMethod('create'));
        expect(JSON.parse(wsInstance.send.getCall(0).args)[1]).to.equal(null);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[2]).to.be.an('object');

        // Now reconnect.
        trace.connect(TEST_WSURL);
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.be.at.least(4);
        expect(JSON.parse(wsInstance.send.getCall(2).args)[0]).to.equal(compressMethod('create'));
        expect(JSON.parse(wsInstance.send.getCall(2).args)[1]).to.equal(null);
        expect(JSON.parse(wsInstance.send.getCall(2).args)[2]).to.be.an('object');
    });

    it('adds the timestamp at which the event was traced', async () => {
        const trace = new WebSocketTrace();
        const before = Date.now();
        trace.connect(TEST_WSURL);
        const after = Date.now();
        await new Promise(r => setTimeout(r, 50));
        await wsInstance.mockOpen();
        expect(wsInstance.send.callCount).to.be.at.least(1);
        expect(JSON.parse(wsInstance.send.getCall(0).args)[3]).to.be.within(before, after);
    });

    it('allows passing a peerconnection as second argument and looks up the rtcStatsId', async () => {
        const trace = new WebSocketTrace();
        const pc = new RTCPeerConnection();
        pc.__rtcStatsId = 'something for test';

        trace.connect(TEST_WSURL);
        await wsInstance.mockOpen();
        trace('method', pc);
        expect(wsInstance.send.callCount).to.be.at.least(3);
        expect(JSON.parse(wsInstance.send.getCall(2).args)[1]).to.equal(pc.__rtcStatsId);
    });

    it('closes existing connections if connect is called again', () => {
        const trace = new WebSocketTrace();
        trace.connect(TEST_WSURL);
        trace.connect(TEST_WSURL);
        expect(wsInstance.close.callCount).to.equal(1);
    });

    it('closes existing connections if close is called', () => {
        const trace = new WebSocketTrace();
        trace.connect(TEST_WSURL);
        trace.close();
        expect(wsInstance.close.callCount).to.equal(1);
    });

    it('logs authorization errors if configured', async () => {
        const logStub = sinon.stub();
        const trace = new WebSocketTrace({log: logStub});
        trace.connect(TEST_WSURL);

        const ev = new Event('close');
        ev.code = 1008;
        wsInstance.dispatchEvent(ev);
        expect(logStub.callCount).to.equal(1);
        expect(logStub.getCall(0).firstArg).to.equal(
            'rtcstats websocket connection closed with error=1008. ' +
            'Typically this means authorization is required and failed.');
    });

    it('logs connection failures if configured', async () => {
        const logStub = sinon.stub();
        const trace = new WebSocketTrace({log: logStub});
        trace.connect(TEST_WSURL);
        await wsInstance.mockRefuse();
        expect(logStub.callCount).to.equal(1);
        expect(logStub.getCall(0).firstArg).to.equal('rtcstats websocket connection error');
    });

    describe('session reload counting', () => {
        afterEach(() =>{
            sessionStorage.clear();
        });

        it('does not count unless configured', () => {
            const trace = new WebSocketTrace({countReloads: false});
            expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal(null);
        });

        it('counts when configured', () => {
            const trace = new WebSocketTrace({countReloads: true});
            expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal('0');
        });

        it('increments the session count', () => {
            sessionStorage.setItem(RELOAD_COUNT_KEY, 15);
            const trace = new WebSocketTrace({countReloads: true});
            expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal('16');
        });

        it('resets after explicit close', () => {
            sessionStorage.setItem(RELOAD_COUNT_KEY, 15);
            const trace = new WebSocketTrace({countReloads: true});
            trace.close();
            expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal(null);
        });
    });
});
