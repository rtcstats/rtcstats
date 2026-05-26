import {anonymizeBlob} from '../anonymize.js';

describe('anonymizeBlob', () => {
    it('returns undefined for unrecognized formats', () => {
        expect(anonymizeBlob('not a dump')).to.equal(undefined);
    });

    describe('rtcstats dump', () => {
        it('obfuscates ip addresses in onicecandidate events', async () => {
            const textBlob = 'RTCStatsDump\n' +
                JSON.stringify({fileFormat: 3}) + '\n' +
                JSON.stringify(['onicecandidate', '1', {
                    sdpMid: 0,
                    candidate: 'candidate:1 1 udp 1 192.168.0.1 9 typ host ufrag HjHI\r\n',
                }, 1]);
            const result = await anonymizeBlob(textBlob).text();
            expect(result).to.contain('192.168.0.x');
            expect(result).not.to.contain('192.168.0.1');
            expect(result.startsWith('RTCStatsDump\n')).to.equal(true);
        });
    });

    describe('webrtc-internals dump', () => {
        it('obfuscates address timeseries and updateLog candidates', async () => {
            const input = {
                PeerConnections: {
                    '1-1': {
                        stats: {
                            'cand-1-address': {values: JSON.stringify(['192.168.0.1'])},
                            'cand-1-ip': {values: JSON.stringify(['192.168.0.2'])},
                            'cand-1-relatedAddress': {values: JSON.stringify(['10.0.0.1'])},
                            'cand-1-port': {values: JSON.stringify([4242])},
                        },
                        updateLog: [{
                            type: 'onicecandidate',
                            value: JSON.stringify({
                                sdpMid: 0,
                                candidate: 'candidate:1 1 udp 1 192.168.0.3 9 typ host ufrag HjHI\r\n',
                            }),
                        }],
                    },
                },
            };
            const json = JSON.parse(await anonymizeBlob(JSON.stringify(input)).text());
            const pc = json.PeerConnections['1-1'];
            expect(JSON.parse(pc.stats['cand-1-address'].values)).to.deep.equal(['192.168.0.x']);
            expect(JSON.parse(pc.stats['cand-1-ip'].values)).to.deep.equal(['192.168.0.x']);
            expect(JSON.parse(pc.stats['cand-1-relatedAddress'].values)).to.deep.equal(['10.0.0.x']);
            // Unrelated stats types are left alone.
            expect(JSON.parse(pc.stats['cand-1-port'].values)).to.deep.equal([4242]);
            expect(JSON.parse(pc.updateLog[0].value).candidate).to.contain('192.168.0.x');
        });
    });
});
