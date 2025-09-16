import {RTCStatsServer} from '../rtcstats-server.js';
describe('RTCStatsServer', () => {
    it('starts and stops', async () => {
        const server = new RTCStatsServer();
        await server.listen();
        await server.close();
    });
});
