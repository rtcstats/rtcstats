import {readRTCStatsDump} from '../dump.js';

describe.only('RTCStats dump', () => {
    describe('reading', () => {
        it('reads a minimal sample dump', async () => {
            const blob = new Blob(['RTCStatsDump\n' + JSON.stringify({fileFormat: 3})]);
            const result = await readRTCStatsDump(blob);
            expect(result).to.deep.equal({
                fileFormat: 3,
                peerConnections: {},
                eventSizes: {},
            });
        });
    });
});
