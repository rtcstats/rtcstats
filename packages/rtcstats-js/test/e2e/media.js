import {wrapGetUserMedia, wrapEnumerateDevices} from '../../media.js';
import {createTestSink} from '../sink.js';
import {dumpTrackWithStreams} from '@rtcstats/rtcstats-shared';

let testSink;
before(() => {
    before(() => {
        testSink = createTestSink();
        
        // Wrap with empty navigator for coverage.
        wrapGetUserMedia(testSink.trace, {});
        wrapEnumerateDevices(testSink.trace, {});
        // Wrap with empty navigator.mediaDevices for coverage.
        wrapGetUserMedia(testSink.trace, {navigator: {mediaDevices: {}}});
        wrapEnumerateDevices(testSink.trace, {navigator: {mediaDevices: {}}});

        // Actually wrap.
        wrapGetUserMedia(testSink.trace, window);
        wrapEnumerateDevices(testSink.trace, window);
    });
    beforeEach(() => {
        testSink.reset();
    });
});

describe('getUserMedia', () => {
    it('prevents double-wrapping', async () => {
        wrapGetUserMedia(testSink.trace, {navigator});

        const stream = await navigator.mediaDevices.getUserMedia({video: true});

        const events = testSink.reset();
        expect(events.length).to.equal(2);
    });

    it('serializes getUserMediaOnSuccess', async () => {
        const constraints = {audio: true, video: true};
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        const events = testSink.reset();
        expect(events.length).to.equal(2);

        expect(events[0][0]).to.equal('navigator.mediaDevices.getUserMedia');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.deep.equal(constraints);
        expect(events[0][3]).to.be.a('string');

        expect(events[1][0]).to.equal('navigator.mediaDevices.getUserMediaOnSuccess');
        expect(events[1][1]).to.equal(null);
        expect(events[1][2]).to.deep.equal(
            stream.getTracks().map(track => dumpTrackWithStreams(track, stream))
        );
        expect(events[1][3]).to.be.a('string');

        // Ensure tracking ids are set and equal.
        expect(events[0][3]).to.equal(events[1][3]);
    });

    it('serializes getUserMediaOnFailure', async () => {
        const constraints = {video: {width: {min: 65536}, height: 65536}};
        let err;
        try {
            await navigator.mediaDevices.getUserMedia(constraints);
        } catch(e) { err = e; }
        expect(err).not.to.equal(undefined);

        const events = testSink.reset();
        expect(events.length).to.equal(2);

        expect(events[0][0]).to.equal('navigator.mediaDevices.getUserMedia');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.deep.equal(constraints);
        expect(events[0][3]).to.be.a('string');

        expect(events[1][0]).to.equal('navigator.mediaDevices.getUserMediaOnFailure');
        expect(events[1][1]).to.equal(null);
        expect(events[1][2]).to.be.a('string');
        expect(events[1][3]).to.be.a('string');

        expect(events[0][3]).to.equal(events[1][3]);
    });
    
    it('serializes track.stop()', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({audio: true});
        const [track] = stream.getTracks();
        track.stop();
        // Stop twice, should only be serialized once.
        track.stop();

        const events = testSink.reset();
        expect(events.length).to.equal(3);
        expect(events[2][0]).to.equal('MediaStreamTrack.stop');
        expect(events[2][1]).to.equal(null);
        expect(events[2][2]).to.deep.equal([]);
        expect(events[2][3]).to.equal(track.id);
        expect(events[2][4]).to.equal(track.__rtcStatsId);
    });

    it('serializes track.applyConstraints()', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        const [track] = stream.getTracks();
        track.applyConstraints({width: 320});
        // Stop twice, should no longer be serialized.
        track.stop();
        track.applyConstraints({});

        const events = testSink.reset();
        expect(events.length).to.equal(4);
        expect(events[2][0]).to.equal('MediaStreamTrack.applyConstraints');
        expect(events[2][1]).to.equal(null);
        expect(events[2][2]).to.deep.equal([{width: 320}]);
        expect(events[2][3]).to.equal(track.id);
        expect(events[2][4]).to.equal(track.__rtcStatsId);
        expect(events[3][0]).to.equal('MediaStreamTrack.stop');
    });

    it('serializes track.enabled setter', async () => {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        const [track] = stream.getTracks();
        track.enabled = false;
        track.enabled = !track.enabled;

        const events = testSink.reset();
        expect(events.length).to.equal(4);
        expect(events[2][0]).to.equal('MediaStreamTrack.enabled');
        expect(events[2][1]).to.equal(null);
        expect(events[2][2]).to.equal(false);
        expect(events[2][3]).to.equal(track.id);
        expect(events[3][0]).to.equal('MediaStreamTrack.enabled');
        expect(events[3][1]).to.equal(null);
        expect(events[3][2]).to.equal(true);
        expect(events[3][3]).to.equal(track.id);
    });
});

describe('getDisplayMedia', () => {
    it('serializes getDisplayMediaOnSuccess', async function() {
        if ('mozGetUserMedia' in navigator) {
            this.skip();
        }

        const constraints = {video: true};
        const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

        const events = testSink.reset();
        expect(events.length).to.equal(2);

        expect(events[0][0]).to.equal('navigator.mediaDevices.getDisplayMedia');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.deep.equal(constraints);
        expect(events[0][3]).to.be.a('string');

        expect(events[1][0]).to.equal('navigator.mediaDevices.getDisplayMediaOnSuccess');
        expect(events[1][1]).to.equal(null);
        expect(events[1][2]).to.deep.equal(
            stream.getTracks().map(track => dumpTrackWithStreams(track, stream))
        );
        expect(events[1][3]).to.be.a('string');

        expect(events[0][3]).to.equal(events[1][3]);
    });

    it('serializes getDisplayMediaOnFailure', async () => {
        const constraints = {video: {width: {min: 65536}, height: 65536}};
        let err;
        try {
            await navigator.mediaDevices.getDisplayMedia(constraints);
        } catch(e) { err = e; }
        expect(err).not.to.equal(undefined);

        const events = testSink.reset();
        expect(events.length).to.equal(2);

        expect(events[0][0]).to.equal('navigator.mediaDevices.getDisplayMedia');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.deep.equal(constraints);

        expect(events[1][0]).to.equal('navigator.mediaDevices.getDisplayMediaOnFailure');
        expect(events[1][1]).to.equal(null);
        expect(events[1][2]).to.be.a('string');
    });
});

describe('mediaDevices', () => {
    it('prevents double-wrapping of enumerateDevices', async () => {
        wrapEnumerateDevices(testSink.trace, window);
    });

    it('serializes enumerateDevices', async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();

        const events = testSink.reset();
        expect(events.length).to.equal(1);
        expect(events[0][0]).to.equal('navigator.mediaDevices.enumerateDevices');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.deep.equal(JSON.parse(JSON.stringify(devices)));
    });

    it('serializes ondevicechange', async () => {
        const deviceChange = new Event('devicechange');
        navigator.mediaDevices.dispatchEvent(deviceChange);

        const events = testSink.reset();
        expect(events.length).to.equal(1);
        expect(events[0][0]).to.equal('navigator.mediaDevices.ondevicechange');
        expect(events[0][1]).to.equal(null);
        expect(events[0][2]).to.equal(null);
    });
});
