import { expect } from '@esm-bundle/chai';

import {wrapRTCPeerConnection} from '../../peerconnection.js';
import {createTestSink} from '../sink.js';
import {statsDecompression} from '@rtcstats/rtcstats-shared';
import {dumpTrackWithStreams} from '@rtcstats/rtcstats-shared';

const sdp = `v=0
o=- 0 3 IN IP4 127.0.0.1
s=-
t=0 0
a=fingerprint:sha-256 A7:24:72:CA:6E:02:55:39:BA:66:DF:6E:CC:4C:D8:B0:1A:BF:1A:56:65:7D:F4:03:AD:7E:77:43:2A:29:EC:93
a=ice-ufrag:6HHHdzzeIhkE0CKj
a=ice-pwd:XYDGVpfvklQIEnZ6YnyLsAew
m=audio 9 RTP/SAVPF 111
c=IN IP4 0.0.0.0
a=rtcp-mux
a=sendonly
a=mid:audio
a=rtpmap:111 opus/48000/2
a=setup:actpass
a=msid:streamid trackid 
`;
const candidateSdp = 'a=candidate:1595511860 1 udp 2122262783 192.168.0.1 36538 typ host generation 0 ufrag HjHI\r\n';

async function negotiate(pc1, pc2) {
    pc1.onicecandidate = (e) => pc2.addIceCandidate(e.candidate);
    pc2.onicecandidate = (e) => pc1.addIceCandidate(e.candidate);
    await pc1.setLocalDescription();
    await pc2.setRemoteDescription(pc1.localDescription);
    await pc2.setLocalDescription();
    await pc1.setRemoteDescription(pc2.localDescription);
}

// Lower than usual for tests.
const getStatsInterval = 100;

// Event sink.
let testSink;
before(() => {
    before(() => {
        testSink = createTestSink();
        // Wrap with fake window object for coverage.
        wrapRTCPeerConnection(testSink.trace, {}, {});
        wrapRTCPeerConnection(testSink.trace, {
            RTCPeerConnection: function mock() {},
        }, {});
        wrapRTCPeerConnection(testSink.trace, {
            RTCPeerConnection: function mock() {},
            RTCRtpTransceiver: function mock() {},
            RTCRtpSender: function mock() {},
        }, {});

        // Actually wrap.
        wrapRTCPeerConnection(testSink.trace, window, {getStatsInterval});
    });
    beforeEach(() => {
        testSink.reset();
    });
    afterEach(() => {
        testSink.reset();
    });
});

it('RTCStats does not wrap twice', () => {
    wrapRTCPeerConnection(testSink.trace, window, {getStatsInterval});
    const pc = new RTCPeerConnection();
    pc.close();

    const events = testSink.reset();
    expect(events).to.have.length(2);
});

describe('RTCPeerConnection', () => {
    let pc;
    let pc1;
    let pc2;
    afterEach(() => {
        [pc, pc1, pc2].forEach(peerConnection => {
            if (peerConnection) peerConnection.close();
        });
    });

    describe('peerconnection creation', () => {
        it('serializes the creation', () => {
            const now = Date.now();
            pc = new RTCPeerConnection({});

            const events = testSink.reset();
            expect(events).to.have.length(1);
            expect(events[0][0]).to.equal('create');
            expect(events[0][1]).to.equal(pc.__rtcStatsId);
            expect(events[0][2]).to.be.an('object');
            expect(events[0][3] - now).to.be.below(1000); // less than 1000ms.
        });

        it('serializes the legacy constraints', () => {
            const now = Date.now();
            pc = new RTCPeerConnection(null, {old: 'crap'});

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('constraints');
            expect(events[1][1]).to.equal(pc.__rtcStatsId);
            expect(events[1][2]).to.deep.equal({old: 'crap'});
        });

        it('increments the peerconnection index', () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[0][1]).to.equal(pc1.__rtcStatsId);
            expect(events[1][1]).to.equal(pc2.__rtcStatsId);
            pc1.close();
            pc2.close();
        });

        it('serializes the RTCConfiguration', () => {
            const configuration = {iceServers: []};
            pc = new RTCPeerConnection(configuration);

            const events = testSink.reset();
            expect(events).to.have.length(1);
            expect(events[0][2]).to.deep.equal(configuration);
        });

        it('removes turn credentials from the configuration', () => {
            const configuration = {iceServers: [{
                urls: 'turn:example.com',
                username: 'test',
                credential: 'test',
            }]};
            pc = new RTCPeerConnection(configuration);

            // Check that the original config was not modified, then delete it.
            expect(configuration.iceServers[0].credential).to.equal('test');
            delete configuration.iceServers[0].credential;

            const events = testSink.reset();
            expect(events).to.have.length(1);
            expect(events[0][0]).to.deep.equal('create');
            expect(events[0][2]).to.deep.equal(configuration);
        });
    });

    describe('setConfiguration', () => {
        it('removes turn credentials from the configuration', () => {
            const configuration = {iceServers: [{
                urls: 'turn:example.com',
                username: 'test',
                credential: 'test',
            }]};
            pc = new RTCPeerConnection();
            pc.setConfiguration(configuration);

            // Test that credential was removed.
            expect(configuration.iceServers[0].credential).to.equal('test');
            delete configuration.iceServers[0].credential;

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('setConfiguration');
            expect(events[1][2]).to.deep.equal(configuration);
        });
    });

    describe('createOffer', () => {
        it('serializes', async () => {
            pc = new RTCPeerConnection();
            const offer = await pc.createOffer();

            const events = testSink.reset();
            expect(events).to.have.length(3);

            expect(events[1][0]).to.equal('createOffer');
            expect(events[1][2]).to.equal(undefined);
            expect(events[1][3]).to.be.a('string');
        });

        it('serializes the result', async () => {
            pc = new RTCPeerConnection();
            const offer = await pc.createOffer();

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.be.a('string');

            expect(events[2][0]).to.equal('createOfferOnSuccess');
            expect(events[2][2].type).to.equal('offer');
            expect(events[2][2].sdp).to.equal(offer.sdp);
            expect(events[2][3]).to.be.a('string');

            expect(events[1][3]).to.equal(events[2][3]);
        });
    });

    describe('createAnswer', () => {
        it('serializes', async () => {
            pc = new RTCPeerConnection();
            const offer = await pc.createOffer();
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();

            const events = testSink.reset();
            expect(events).to.have.length(8);
            expect(events[6][0]).to.equal('createAnswer');
            expect(events[6][2]).to.equal(undefined);
            expect(events[6][3]).to.be.a('string');
        });

        it('serializes the result', async () => {
            pc = new RTCPeerConnection();
            const offer = await pc.createOffer();
            await pc.setRemoteDescription(offer);
            const answer = await pc.createAnswer();

            const events = testSink.reset();
            expect(events).to.have.length(8);
            expect(events[6][0]).to.equal('createAnswer');

            expect(events[7][0]).to.equal('createAnswerOnSuccess');
            expect(events[7][2].type).to.equal('answer');
            expect(events[7][2].sdp).to.equal(answer.sdp);
            expect(events[7][3]).to.be.a('string');

            expect(events[6][3]).to.equal(events[7][3]);
        });

        it('serializes errors', async () => {
            pc = new RTCPeerConnection();
            try {
                await pc.createAnswer();
            } catch (e) {
                // expected.
            }
            const events = testSink.reset();
            expect(events[1][0]).to.equal('createAnswer');
            expect(events[1][3]).to.be.a('string');

            expect(events[2][0]).to.equal('createAnswerOnFailure');
            expect(events[2][2]).to.be.a('string');
            expect(events[2][3]).to.be.a('string');

            expect(events[1][3]).to.equal(events[2][3]);
        });
    });

    describe('setLocalDescription', () => {
        it('serializes', async () => {
            pc = new RTCPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            const events = testSink.reset();
            expect(events).to.have.length(6);
            expect(events[2][0]).to.equal('createOfferOnSuccess');

            expect(events[3][0]).to.equal('setLocalDescription');
            expect(events[3][2]).to.deep.equal({type: 'offer', sdp: 'v=\r\n'});
            expect(events[3][3]).to.be.a('string');

            expect(events[4][0]).to.equal('onsignalingstatechange');
            expect(events[5][0]).to.equal('setLocalDescriptionOnSuccess');
            expect(events[5][2]).to.equal(undefined);
            expect(events[5][3]).to.be.a('string');

            expect(events[3][3]).to.equal(events[5][3]);
        });

        it('serialized (answer)', async () => {
            pc = new RTCPeerConnection();
            await pc.setRemoteDescription({type: 'offer', sdp});
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            const events = testSink.reset();
            expect(events).to.have.length.at.least(8);
            expect(events[7][0]).to.equal('setLocalDescription');
            expect(events[7][2]).to.deep.equal({type: 'answer', sdp: 'v=\r\nm=\r\n'});
            expect(events[7][3]).to.be.a('string');
        });

        it('serializes the error', async () => {
            pc = new RTCPeerConnection();
            let error;
            try {
                await pc.setLocalDescription({type: 'bogus'});
            } catch(e) {
                // expected.
                error = e;
            }
            expect(error).not.to.equal(undefined);

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[2][0]).to.equal('setLocalDescriptionOnFailure');
            expect(events[2][2]).to.be.a('string');
        });

        it('serializes implicit SLD', async () => {
            pc = new RTCPeerConnection();
            await pc.setLocalDescription();

            const events = testSink.reset();
            expect(events).to.have.length(4);
            expect(events[1][0]).to.equal('setLocalDescription');
            expect(events[1][3]).to.be.a('string');

            expect(events[2][0]).to.equal('onsignalingstatechange');

            expect(events[3][0]).to.equal('setLocalDescriptionOnSuccess');
            expect(events[3][2]).to.deep.equal(pc.localDescription);
            expect(events[3][3]).to.be.a('string');

            expect(events[1][3]).to.equal(events[3][3]);
        });

        it('serializes rollback', async () => {
            pc = new RTCPeerConnection();
            pc.addTransceiver('audio');
            await pc.setLocalDescription();
            await pc.setLocalDescription({type: 'rollback'});

            const events = testSink.reset();
            expect(events[6][0]).to.equal('setLocalDescription');
            expect(events[6][2]).to.deep.equal({type: 'rollback'});
        });
    });

    describe('setRemoteDescription', () => {
        it('serializes', async () => {
            pc = new RTCPeerConnection();
            await pc.setRemoteDescription({type: 'offer', sdp});

            // TODO: remove once unmute bug is fixed on Chrome.
            const events = testSink.reset().filter(e => e[0] !== 'MediaStreamTrack.onunmute');
            expect(events).to.have.length(5);
            expect(events[1][0]).to.equal('setRemoteDescription');
            expect(events[1][2]).to.deep.equal({type: 'offer', sdp});
            expect(events[2][0]).to.equal('onsignalingstatechange');
            expect(events[3][0]).to.equal('ontrack');
            expect(events[4][0]).to.equal('setRemoteDescriptionOnSuccess');
            expect(events[4][2]).to.equal(undefined);
        });

        it('serializes errors', async () => {
            pc = new RTCPeerConnection();
            let error;
            try {
                // Trigger the "fippo-butterfinger-filter"
                await pc.setRemoteDescription({type: 'offer', sdp: sdp + '\u00e4'});
            } catch (e) {
                // expected.
                error = e;
            }
            expect(error).not.to.equal(undefined);
            // Chrome and Firefox behave differently, Firefox triggers more events.

            const events = testSink.reset();
            expect(events[1][0]).to.equal('setRemoteDescription');
            expect(events[2][0]).to.equal('setRemoteDescriptionOnFailure');
            expect(events[2][2]).to.be.a('string');
        });

        it('sets a __rtcStatsId', async () => {
            pc = new RTCPeerConnection();
            await pc.setRemoteDescription({type: 'offer', sdp});
            const transceivers = pc.getTransceivers();
            expect(transceivers).to.have.length(1);
            expect(transceivers[0].__rtcStatsId).to.equal(pc.__rtcStatsId);
        });
    });

    describe('addTrack', () => {
        it('serializes the track in the expected format if there is a stream', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
            stream.getTracks().forEach(t => pc.addTrack(t, stream));

            const events = testSink.reset();
            expect(events).to.have.length(5);
            expect(events[1][0]).to.equal('addTrack');
            expect(events[1][2]).to.deep.equal(dumpTrackWithStreams(stream.getTracks()[0], stream));
            expect(events[2][0]).to.equal('addTrackOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
            expect(events[3][0]).to.equal('addTrack');
            expect(events[3][2]).to.deep.equal(dumpTrackWithStreams(stream.getTracks()[1], stream));
            expect(events[4][0]).to.equal('addTrackOnSuccess');
            expect(events[4][2]).to.equal(null);
            expect(events[4][3]).to.be.a('string');
        });

        it('serializes the track in the expected format if there is no stream', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
            stream.getTracks().forEach(t => pc.addTrack(t));

            const events = testSink.reset();
            expect(events).to.have.length(5);
            expect(events[1][0]).to.equal('addTrack');
            expect(events[1][2]).to.deep.equal(dumpTrackWithStreams(stream.getTracks()[0]));
            expect(events[2][0]).to.equal('addTrackOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
            expect(events[3][0]).to.equal('addTrack');
            expect(events[3][2]).to.deep.equal(dumpTrackWithStreams(stream.getTracks()[1]));
            expect(events[4][0]).to.equal('addTrackOnSuccess');
            expect(events[4][2]).to.equal(null);
            expect(events[4][3]).to.be.a('string');
        });

        it('sets a __rtcStatsId', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const sender = pc.addTrack(stream.getTracks()[0], stream);
            expect(sender).to.be.an.instanceof(RTCRtpSender);
            expect(sender.__rtcStatsId).to.equal(pc.__rtcStatsId);
            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[2][0]).to.equal('addTrackOnSuccess');
            expect(events[2][3]).to.equal(sender.__rtcStatsSenderId);
        });

        it('sets a __rtcStatsSenderId', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const sender = pc.addTrack(stream.getTracks()[0], stream);
            expect(sender).to.be.an.instanceof(RTCRtpSender);
            expect(sender.__rtcStatsSenderId).to.equal(pc.getTransceivers()[0].receiver.track.id);
            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[2][0]).to.equal('addTrackOnSuccess');
            expect(events[2][3]).to.equal(sender.__rtcStatsSenderId);
        });
    });

    describe('addTransceiver', () => {
        it('serializes with string kind', () => {
            pc = new RTCPeerConnection();
            pc.addTransceiver('audio');

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addTransceiver');
            expect(events[1][2]).to.deep.equal(['audio']);
            expect(events[2][0]).to.equal('addTransceiverOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
        });

        it('serializes with track', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            pc.addTransceiver(stream.getTracks()[0]);

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addTransceiver');
            expect(events[1][2]).to.deep.equal([dumpTrackWithStreams(stream.getTracks()[0])]);
            expect(events[2][0]).to.equal('addTransceiverOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
        });

        it('serializes with track and streams', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            pc.addTransceiver(stream.getTracks()[0], {streams: [stream]});

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addTransceiver');
            expect(events[1][2]).to.deep.equal([
                dumpTrackWithStreams(stream.getTracks()[0]),
                {
                    streams: [stream.id],
                }
            ]);
            expect(events[2][0]).to.equal('addTransceiverOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
        });

        it('serializes with kind and streams', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            pc.addTransceiver('audio', {streams: [stream]});
            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addTransceiver');
            expect(events[1][2]).to.deep.equal([
                'audio',
                {
                    streams: [stream.id],
                }
            ]);
        });

        it('serializes with track and sendEncodings', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
            pc.addTransceiver(stream.getTracks()[0], {sendEncodings: [{rid: 'test'}]});
            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addTransceiver');
            expect(events[1][2]).to.deep.equal([
                dumpTrackWithStreams(stream.getTracks()[0]),
                {
                    sendEncodings: [{rid: 'test'}],
                }
            ]);
            expect(events[2][0]).to.equal('addTransceiverOnSuccess');
            expect(events[2][2]).to.equal(null);
            expect(events[2][3]).to.be.a('string');
        });

        it('sets a __rtcStatsId', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const transceiver = pc.addTransceiver(stream.getTracks()[0]);
            expect(transceiver).to.be.an.instanceof(RTCRtpTransceiver);
            expect(transceiver.__rtcStatsId).to.equal(pc.__rtcStatsId);
            expect(transceiver.sender.__rtcStatsId).to.equal(pc.__rtcStatsId);
        });
    });

    describe('addIceCandidate', () => {
        it('serializes the candidate', async () => {
            pc = new RTCPeerConnection();
            await pc.setRemoteDescription({type: 'offer', sdp});
            await pc.addIceCandidate({sdpMid: 'audio', sdpMLineIndex: 0, candidate: candidateSdp});

            // TODO: remove once unmute bug is fixed on Chrome.
            const events = testSink.reset().filter(e => e[0] !== 'MediaStreamTrack.onunmute');
            expect(events).to.have.length(7);
            expect(events[5][0]).to.equal('addIceCandidate');
            expect(events[5][2].sdpMid).to.equal('audio');
            expect(events[5][2].sdpMLineIndex).to.equal(0);
            expect(events[5][2].candidate).to.equal(candidateSdp);
            expect(events[5][3]).to.be.a('string');
            expect(events[6][0]).to.equal('addIceCandidateOnSuccess');
            expect(events[6][2]).to.equal(undefined);
            expect(events[6][3]).to.be.a('string');

            expect(events[5][3]).to.equal(events[6][3]);
        });

        it('serializes the error', async () => {
            pc = new RTCPeerConnection();
            let error;
            try {
                await pc.addIceCandidate({sdpMid: 'audio', sdpMLineIndex: 0, candidate: candidateSdp});
            } catch(e) {
                // expected.
                error = e;
            }
            expect(error).not.to.equal(undefined);

            const events = testSink.reset();
            expect(events).to.have.length(3);
            expect(events[1][0]).to.equal('addIceCandidate');
            expect(events[1][3]).to.be.a('string');
            expect(events[2][0]).to.equal('addIceCandidateOnFailure');
            expect(events[2][2]).to.be.a('string');
            expect(events[2][3]).to.be.a('string');

            expect(events[1][3]).to.equal(events[2][3]);
        });
    });

    describe('removeTrack', () => {
        it('serializes the stream in the expected format', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            const track = stream.getTracks()[0];
            const sender = pc.addTrack(track, stream);
            pc.removeTrack(sender);

            const events = testSink.reset();
            expect(events).to.have.length(4);
            expect(events[3][0]).to.equal('removeTrack');
            expect(events[3][2]).to.equal(sender.__rtcStatsSenderId);
        });
    });

    describe('close', () => {
        it('serializes the event in the expected format', async () => {
            pc = new RTCPeerConnection();
            pc.close();

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('close');
            // TODO: how to deal with raw arguments array (also for datachannel)?
            // expect(events[1][2]).to.equal(undefined);
        });
    });

    describe('restartIce', () => {
        it('serializes the event in the expected format', async () => {
            pc = new RTCPeerConnection();
            pc.restartIce();

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('restartIce');
            // TODO: how to deal with raw arguments array (also for datachannel)?
            // expect(events[1][2]).to.equal(undefined);
        });
    });

    describe('createDataChannel', () => {
        it('serializes the event in the expected format without init', async () => {
            pc = new RTCPeerConnection();
            pc.createDataChannel('somechannel');

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('createDataChannel');
            expect(events[1][2]).to.deep.equal(['somechannel']);

        });

        it('serializes the event in the expected format with init', async () => {
            pc = new RTCPeerConnection();
            pc.createDataChannel('somechannel', {ordered: true});

            const events = testSink.reset();
            expect(events).to.have.length(2);
            expect(events[1][0]).to.equal('createDataChannel');
            expect(events[1][2]).to.deep.equal(['somechannel', {ordered: true}]);
        });
    });

    describe('event handlers', () => {
        it('serializes signalingstatechange', async () => {
            pc = new RTCPeerConnection();
            // offer without m-lines, intentionally.
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const events = testSink.reset();

            const ev = events.find(e => e[0] === 'onsignalingstatechange');
            expect(ev[0]).to.equal('onsignalingstatechange');
            expect(ev[2]).to.equal('have-local-offer');
        });

        it('serializes negotiationneeded', async () => {
            pc = new RTCPeerConnection();
            const onn = new Promise(resolve => {
                pc.onnegotiationneeded = () => {
                    pc.onnegotiationneeded = null;
                    resolve();
                };
            });
            pc.createDataChannel('somechannel');
            await onn;

            const events = testSink.reset();
            const ev = events.find(e => e[0] === 'onnegotiationneeded');
            expect(ev[0]).to.equal('onnegotiationneeded');
            expect(ev[2]).to.equal(undefined);
        });

        it('serializes icecandidate and icegatheringstatechange', async () => {
            pc = new RTCPeerConnection();
            pc.createDataChannel('somechannel');
            const gathered = new Promise(resolve => {
                pc.onicecandidate = (e) => {
                    pc.onicecandidate = null;
                    resolve(e.candidate);
                };
            });
            await pc.setLocalDescription();
            const candidate = await gathered;

            const events = testSink.reset();
            const candidateEvent = events.find(e => e[0] === 'onicecandidate');
            expect(candidateEvent[0]).to.equal('onicecandidate');
            expect(candidateEvent[2]).to.equal(candidate);

            const gatheringEvent = events.find(e => e[0] === 'onicegatheringstatechange');
            expect(gatheringEvent[0]).to.equal('onicegatheringstatechange');
            expect(gatheringEvent[2]).to.equal('gathering');
        });

        it('serializes iceconnectionstatechange', async () => {
            pc = new RTCPeerConnection();
            const gathered = new Promise(resolve => {
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState !== 'complete') return;
                    pc.onicegatheringstatechange = null;
                    resolve();
                };;
            });
            await pc.setRemoteDescription({type: 'offer', sdp: sdp + candidateSdp});
            await pc.setLocalDescription();
            await gathered;
            await (new Promise(r => setTimeout(r, 50))); // deflake Firefox.

            const events = testSink.reset();
            const ev = events.find(e => e[0] === 'oniceconnectionstatechange');
            expect(ev[0]).to.equal('oniceconnectionstatechange');
            expect(ev[2]).to.equal('checking');
        });

        it('serializes connectionstatechange', async () => {
            pc = new RTCPeerConnection();
            const gathered = new Promise(resolve => {
                pc.onicegatheringstatechange = () => {
                    if (pc.iceGatheringState !== 'complete') return;
                    pc.onicegatheringstatechange = null;
                    resolve();
                };;
            });
            await pc.setRemoteDescription({type: 'offer', sdp: sdp + candidateSdp});
            await pc.setLocalDescription();
            await gathered;
            await (new Promise(r => setTimeout(r, 50))); // deflake Firefox.

            const events = testSink.reset();
            const ev = events.find(e => e[0] === 'onconnectionstatechange');
            expect(ev[0]).to.equal('onconnectionstatechange');
            expect(ev[2]).to.equal('connecting');
        });

        it('serializeѕ ontrack', async () => {
            pc = new RTCPeerConnection();
            await pc.setRemoteDescription({type: 'offer', sdp});
            const track = pc.getReceivers()[0].track;

            // TODO: remove once unmute bug is fixed on Chrome.
            const events = testSink.reset().filter(e => e[0] !== 'MediaStreamTrack.onunmute');
            expect(events).to.have.length(5);
            const trackEvent = events.find(e => e[0] === 'ontrack');
            expect(trackEvent[0]).to.equal('ontrack');
            expect(trackEvent[2]).to.deep.equal(['audio',  track.id, track.id, 'streamid']);
        });

        it('serializeѕ MediaStreamTrack.on(un)mute', async () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            stream.getTracks().forEach(t => pc1.addTrack(t, stream));
            const waitForUnmute = new Promise(resolve => {
                pc2.addEventListener('track', ({track}) => {
                    track.addEventListener('unmute', () => resolve(), {once: true});
                }, {once: true});
            });
            const waitForMute = new Promise(resolve => {
                pc2.addEventListener('track', ({track}) => {
                    track.addEventListener('mute', () => resolve(), {once: true});
                }, {once: true});
            });
            await negotiate(pc1, pc2);
            await waitForUnmute;

            pc1.getTransceivers()[0].direction = 'inactive';
            await negotiate(pc1, pc2);
            await waitForMute;

            const events = testSink.reset();
            const unmuteEvent = events.find(e => e[0] === 'MediaStreamTrack.onunmute');
            expect(unmuteEvent[0]).to.equal('MediaStreamTrack.onunmute');
            expect(unmuteEvent[2]).to.deep.equal(pc2.getReceivers()[0].track.id);

            const muteEvent = events.find(e => e[0] === 'MediaStreamTrack.onmute');
            expect(muteEvent[0]).to.equal('MediaStreamTrack.onmute');
            expect(muteEvent[2]).to.deep.equal(pc2.getReceivers()[0].track.id);
        });

        it('serializes onicecandidate', async () => {
            pc = new RTCPeerConnection();

            const hostCandidateEvent = new Event('icecandidate');
            hostCandidateEvent.candidate = new RTCIceCandidate({
                sdpMid: '0',
                candidate: candidateSdp.substring(2).trim(),
            });
            pc.dispatchEvent(hostCandidateEvent);

            const turnCandidateEvent = new Event('icecandidate');
            turnCandidateEvent.candidate = new RTCIceCandidate({
                sdpMid: '0',
                candidate: candidateSdp.substring(2).replace('host', 'relay').trim(),
            }).toJSON();
            turnCandidateEvent.candidate.url = 'turn:example.org';
            turnCandidateEvent.candidate.relayProtocol = 'udp';
            pc.dispatchEvent(turnCandidateEvent);

            const nullCandidateEvent = new Event('icecandidate');
            nullCandidateEvent.candidate = null;
            pc.dispatchEvent(nullCandidateEvent);

            const events = testSink.reset();
            expect(events[1][0]).to.equal('onicecandidate');
            expect(events[1][2]).to.equal(hostCandidateEvent.candidate);

            expect(events[2][0]).to.equal('onicecandidate');
            expect(events[2][2]).to.equal(turnCandidateEvent.candidate);

            expect(events[3][0]).to.equal('onicecandidate');
            expect(events[3][2]).to.equal(null);
        });
        
        it('serializes ondatachannel', async () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const onchannel = new Promise(resolve => {
                pc2.ondatachannel = (e) => {
                    pc2.ondatachannel = null;
                    resolve(e.channel);
                };
            });
            pc1.createDataChannel('test');

            await negotiate(pc1, pc2);

            const channel = await onchannel;

            const events = testSink.reset();
            const ev = events.find(e => e[0] === 'ondatachannel');
            expect(ev[2]).to.be.an('array');
            expect(ev[2][0]).to.equal(channel.id);
            expect(ev[2][1]).to.equal(channel.label);
        });

        it('serializes icecandidateerror', () => {
            pc = new RTCPeerConnection();
            const icecandidateerror = new Event('icecandidateerror');
            icecandidateerror.address = '192.167.0.x',
            icecandidateerror.port = 33505;
            icecandidateerror.hostCandidate = '192.168.0.x:33505';
            icecandidateerror.url = 'turn:127.0.0.1';
            icecandidateerror.errorCode = 401;
            icecandidateerror.errorText = 'Unauthorized.';
            pc.dispatchEvent(icecandidateerror);

            const events = testSink.reset();
            expect(events[1][2]).to.be.an('object');
            ['address', 'port', 'hostCandidate',
                'url', 'errorCode', 'errorText'].forEach(key => {
                expect(events[1][2][key]).to.equal(icecandidateerror[key]);
            });
        });
    });

    describe('transceiver', () => {
        it('serializes setCodecPreferences', () => {
            pc = new RTCPeerConnection();
            const transceiver = pc.addTransceiver('audio');
            const {codecs} = RTCRtpReceiver.getCapabilities('audio');
            transceiver.setCodecPreferences([codecs[0]]);

            const events = testSink.reset();
            expect(events[3][0]).to.equal('setCodecPreferences');
            expect(events[3][1]).to.equal(pc.__rtcStatsId);
            expect(events[3][2]).to.deep.equal([codecs[0]]);
            expect(events[3][3]).to.equal(transceiver.receiver.track.id);
        });

        it('serializes setHeaderExtensionsToNegotiate', function() {
            if ('mozGetUserMedia' in navigator) {
                this.skip();
            }
            pc = new RTCPeerConnection();
            const transceiver = pc.addTransceiver('audio');
            const ext = transceiver.getHeaderExtensionsToNegotiate();
            transceiver.setHeaderExtensionsToNegotiate(ext);

            const events = testSink.reset();
            expect(events[3][0]).to.equal('setHeaderExtensionsToNegotiate');
            expect(events[3][1]).to.equal(pc.__rtcStatsId);
            expect(events[3][2]).to.deep.equal(ext);
            expect(events[3][3]).to.equal(transceiver.receiver.track.id);
        });
    });

    describe('sender', () => {
        it('serializes setParameters', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const sender = pc.addTrack(stream.getTracks()[0]);
            const parameters = sender.getParameters();
            sender.setParameters(parameters);

            // Should not be serialized.
            delete parameters.transactionId;

            const events = testSink.reset();
            expect(events[3][0]).to.equal('setParameters');
            expect(events[3][1]).to.equal(pc.__rtcStatsId);
            expect(events[3][2]).to.deep.equal([parameters]);
            expect(events[3][3]).to.equal(sender.__rtcStatsSenderId);
        });

        it('serializes replaceTrack', async () => {
            pc = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const sender = pc.addTrack(stream.getTracks()[0]);
            await sender.replaceTrack(null);
            await sender.replaceTrack(stream.getTracks()[0]);

            const events = testSink.reset();
            const replaceTrackEvents = events.filter(e => e[0] === 'replaceTrack');
            expect(replaceTrackEvents).to.have.length(2);
            expect(replaceTrackEvents[0][0]).to.equal('replaceTrack');
            expect(replaceTrackEvents[0][1]).to.equal(pc.__rtcStatsId);
            expect(replaceTrackEvents[0][2]).to.deep.equal([
                dumpTrackWithStreams(stream.getTracks()[0]),
                null,
            ]);
            expect(replaceTrackEvents[0][3]).to.equal(sender.__rtcStatsSenderId);

            expect(replaceTrackEvents[1][0]).to.equal('replaceTrack');
            expect(replaceTrackEvents[1][1]).to.equal(pc.__rtcStatsId);
            expect(replaceTrackEvents[1][2]).to.deep.equal([
                null,
                dumpTrackWithStreams(stream.getTracks()[0]),
            ]);
            expect(replaceTrackEvents[1][3]).to.equal(sender.__rtcStatsSenderId);
        });
    });

    describe('generateCertificate', () => {
        it('serializes certificates passed in', async () => {
            const certificate = await RTCPeerConnection.generateCertificate({
                name: 'ECDSA',
                namedCurve: 'P-256',
            });
            const fingerprints = certificate.getFingerprints();
            expect(fingerprints).to.have.length(1);
            pc = new RTCPeerConnection({certificates: [certificate]});

            const events = testSink.reset();
            expect(events).to.have.length(1);
            expect(events[0][0]).to.equal('create');
            expect(events[0][2]).to.be.an('object');
            const certificates = events[0][2].certificates;
            expect(certificates).to.be.an('array');
            expect(certificates).to.have.length(1);
            expect(certificates[0].expires).to.equal(certificate.expires);
            expect(certificates[0].fingerprints).to.be.an('array');
            expect(certificates[0].fingerprints).to.have.length(1);
            expect(certificates[0].fingerprints).to.deep.equal(fingerprints);
        });
    });

    describe('getStats', () => {
        it('does not get traced (for now)', async () => {
            pc = new RTCPeerConnection();
            await pc.getStats();

            const events = testSink.reset();
            expect(events).to.have.length(1);
        });
    });

    describe('stats gathering', async () => {
        it('gathers on connect', async function() {
            if ('mozGetUserMedia' in navigator) {
                // TODO: timing issue in Firefox.
                this.skip();
            }
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const onchannel = new Promise(resolve => {
                pc2.ondatachannel = (e) => {
                    pc2.ondatachannel = null;
                    resolve(e.channel);
                };
            });
            pc1.createDataChannel('test');

            await negotiate(pc1, pc2);
            const channel = await onchannel;
            await (new Promise(resolve => setTimeout(resolve, 0.1 * getStatsInterval)));

            const events = testSink.reset()
                .filter(e => e[0] === 'getStats' && e[1] === pc1.__rtcStatsId);
            expect(events).to.have.length(1);
            expect(events[0][0]).to.equal('getStats');
            expect(events[0][2]).to.be.an('object');
            expect(events[0][3]).to.equal('connected-0');
        });
        it('gathers periodically after connect', async () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const onchannel = new Promise(resolve => {
                pc2.ondatachannel = (e) => {
                    pc2.ondatachannel = null;
                    resolve(e.channel);
                };
            });
            pc1.createDataChannel('test');

            await negotiate(pc1, pc2);
            const channel = await onchannel;
            await (new Promise(resolve => setTimeout(resolve, 0.1 * getStatsInterval)));
            await (new Promise(resolve => setTimeout(resolve, 1.2 * getStatsInterval)));

            const events = testSink.reset()
                .filter(e => e[0] === 'getStats' && e[1] === pc1.__rtcStatsId);
            expect(events).to.have.length(2);
            expect(events[0][0]).to.equal('getStats');
            expect(events[0][2]).to.be.an('object');
            expect(events[1][0]).to.equal('getStats');
            expect(events[1][2]).to.be.an('object');
        });
        it('stops after the connection is closed', async () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const onchannel = new Promise(resolve => {
                pc2.ondatachannel = (e) => {
                    pc2.ondatachannel = null;
                    resolve(e.channel);
                };
            });
            pc1.createDataChannel('test');

            await negotiate(pc1, pc2);
            await onchannel;
            await (new Promise(resolve => setTimeout(resolve, 0.1 * getStatsInterval)));
            pc1.close();
            await (new Promise(resolve => setTimeout(resolve, 1.2 * getStatsInterval)));

            const events = testSink.reset()
                .filter(e => ['getStats', 'close'].includes(e[0]) && e[1] === pc1.__rtcStatsId);
            
            expect(events).to.have.length(2);
            expect(events[0][0]).to.equal('getStats');
            expect(events[1][0]).to.equal('close');
        });
    });

    describe('video integration', () => {
        it('serializes resize', async () => {
            pc1 = new RTCPeerConnection();
            pc2 = new RTCPeerConnection();
            const stream = await navigator.mediaDevices.getUserMedia({video: true});
            stream.getTracks().forEach(t => pc1.addTrack(t, stream));
            const waitForResize = new Promise(resolve => {
                pc2.addEventListener('track', (e) => {
                    const v = document.createElement('video');
                    document.body.appendChild(v);
                    v.srcObject = e.streams[0];
                    v.addEventListener('resize', () => {
                        v.remove();
                        setTimeout(resolve, 0);
                    });
                });
            });
            await negotiate(pc1, pc2);
            await waitForResize;

            const events = testSink.reset()
                .filter(e => e[0] === 'HTMLMediaElement.resize');
            expect(events).to.have.length.at.least(1);
            expect(events[0][0]).to.equal('HTMLMediaElement.resize');
            expect(events[0][1]).to.equal(pc2.__rtcStatsId);
            expect(events[0][2]).to.be.an('object');
            expect(events[0][2]).to.have.property('videoWidth');
            expect(events[0][2]).to.have.property('videoHeight');
            expect(events[0][2]).to.have.property('width');
            expect(events[0][2]).to.have.property('height');
            expect(events[0][3]).to.equal(pc2.getReceivers()[0].track.id);
        });
    });
});

describe('getStats compression', () => {
    let pc1;
    let pc2;
    afterEach(() => {
        [pc1, pc2].forEach(peerConnection => {
            if (peerConnection) peerConnection.close();
        });
    });
    it('reduces quite a bit', async () => {
        pc1 = new RTCPeerConnection();
        pc2 = new RTCPeerConnection();
        pc1.onicecandidate = (e) => pc2.addIceCandidate(e.candidate);
        pc2.onicecandidate = (e) => pc1.addIceCandidate(e.candidate);

        const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
        stream.getTracks().forEach(t => pc1.addTrack(t, stream));
        pc1.createDataChannel('test');

        const onchannel = new Promise(resolve => {
            pc2.ondatachannel = (e) => {
                pc2.ondatachannel = null;
                resolve(e.channel);
            };
        });

        // Negotiate.
        await pc1.setLocalDescription();
        await pc2.setRemoteDescription(pc1.localDescription);
        await pc2.setLocalDescription();
        await pc1.setRemoteDescription(pc2.localDescription);

        await onchannel;

        await (new Promise(resolve => setTimeout(resolve, 1000)));
        const events = testSink.reset();
        let baseStats = {};
        events.forEach((e, index) => {
            if (e[0] !== 'getStats') return;
            baseStats = statsDecompression(baseStats, e[2]);
            console.log('getStats', JSON.stringify(e[2]).length, JSON.stringify(baseStats).length);
        });
    });
});
