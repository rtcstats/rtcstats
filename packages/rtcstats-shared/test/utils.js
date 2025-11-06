import {map2obj} from '../utils.js';
import {dumpTrackWithStreams, parseTrackWithStreams} from '../utils.js';
import {copyAndSanitizeConfig} from '../utils.js';

describe('utils', () => {
    describe('map2obj', () => {
        it('returns the argument as-is when the argument is not a map', () => {
            const a = {};
            expect(map2obj(a)).to.deep.equal(a);
        });
        it('returns an object when the argument is a map', () => {
            const m = new Map([['abc', 'def']]);
            expect(map2obj(m)).to.deep.equal({abc: 'def'});
        });
    });

    describe('dumpTrackWithStreams', () => {
        const track = {kind: 'audio', id: '123', label: 'tracklabel'};
        const streams = [{id: 's1'}, {id: 's2'}];
        it('serializes without a stream', () => {
            expect(dumpTrackWithStreams(track)).to.deep.equal(['audio', '123', 'tracklabel']);
        });
        it('serializes with a single stream', () => {
            expect(dumpTrackWithStreams(track, streams[0])).to.deep.equal(['audio', '123', 'tracklabel', 's1']);
        });
        it('serializes with multiple streams', () => {
            expect(dumpTrackWithStreams(track, ...streams)).to.deep.equal(['audio', '123', 'tracklabel', 's1', 's2']);
        });
    });
    describe('parseTrackWithStreams', () => {
        it('parse the expected format', () => {
            expect(parseTrackWithStreams(['audio', '123', 'tracklabel', 's1', 's2']))
                .to.deep.equal({
                    kind: 'audio',
                    id: '123',
                    label: 'tracklabel',
                    streams: ['s1', 's2'],
                });
        });
    });

    describe('copyAndSanitizeConfig', () => {
        it('serializeѕ the empty config', () => {
            expect(copyAndSanitizeConfig()).to.equal(undefined);
        });
        it('sanitizes iceServers and removes credentials', () => {
            expect(copyAndSanitizeConfig({
                iceServers: [{
                    credential: 'hide me',
                }]})).to.deep.equal({iceServers: [{}]});
        });
        it('serializeѕ certificates', () => {
            const cert = {
                expires: 123,
                getFingerprints: () => [1],
            };
            expect(copyAndSanitizeConfig({certificates: [cert]}))
                .to.deep.equal({certificates: [{
                    expires: 123,
                    fingerprints: [1],
                }]});
        });
    });
});
