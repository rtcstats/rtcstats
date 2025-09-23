import SDPUtils from 'sdp';

import {obfuscateAddress} from '../address-obfuscator.js';

const sdp = `v=0
o=- 0 3 IN IP4 127.0.0.1
s=-
t=0 0
a=fingerprint:sha-256 A7:24:72:CA:6E:02:55:39:BA:66:DF:6E:CC:4C:D8:B0:1A:BF:1A:56:65:7D:F4:03:AD:7E:77:43:2A:29:EC:93
a=ice-ufrag:6HHHdzzeIhkE0CKj
a=ice-pwd:XYDGVpfvklQIEnZ6YnyLsAew
m=audio 9 RTP/SAVPF 111
c=IN IP4 8.8.8.8
a=rtcp:9 IN IP4 8.8.8.8
a=rtcp-mux
a=sendonly
a=mid:audio
a=rtpmap:111 opus/48000/2
a=setup:actpass
a=msid:streamid trackid 
`;
const candidateSdp = 'candidate:1 1 udp 1 192.168.0.1 9 typ host ufrag HjHI\r\n';
const relayCandidateSdp = 'candidate:1 1 udp 1 8.8.8.8 9 typ relay raddr 1.1.1.1 rport 9 ufrag HjHI\r\n';

describe('address obfuscation', () => {
    it('does not obfuscate 127.0.0.1', () => {
        const e = ['publicIP', null, '127.0.0.1'];
        obfuscateAddress('publicIP', e);
        expect(e[2]).to.equal('127.0.0.1');
    });
    it('does not obfuscate ::1', () => {
        const e = ['publicIP', null, '::1'];
        obfuscateAddress('publicIP', e);
        expect(e[2]).to.equal('::1');
    });
    it('obfuscates the public ip', () => {
        const e = ['publicIP', null, '8.8.8.8'];
        obfuscateAddress('publicIP', e);
        expect(e[2]).to.equal('8.8.8.x');
    });
    it('obfuscates the public ips', () => {
        const e = ['publicIP', null, ['8.8.8.8', '1.1.1.1']];
        obfuscateAddress('publicIP', e);
        expect(e[2]).to.deep.equal(['8.8.8.x', '1.1.1.x']);
    });
    ['onicecandidate', 'addIceCandidate'].forEach(method => {
        describe(method, () => {
            it('obfuscateAddresѕ IPv4 addresses', () => {
                const e = [method, null, {
                    sdpMid: 0,
                    candidate: candidateSdp,
                }];
                obfuscateAddress(method, e);

                const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
                expect(obfuscateAddressdCandidate.address).to.equal('192.168.0.x');
                expect(obfuscateAddressdCandidate.ip).to.equal('192.168.0.x');
            });

            it('obfuscates IPv6 addresses', () => {
                const e = [method, null, {
                    sdpMid: 0,
                    candidate: candidateSdp.replace('192.168.0.1', '2001:DB8::8:800:200C:417A'),
                }];
                obfuscateAddress(method, e);

                const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
                expect(obfuscateAddressdCandidate.address).to.equal('2001:DB8:x:x:x:x:x:x');
                expect(obfuscateAddressdCandidate.ip).to.equal('2001:DB8:x:x:x:x:x:x');
            });

            it('does not obfuscate hostnames', () => {
                const e = [method, null, {
                    sdpMid: 0,
                    candidate: candidateSdp.replace('192.168.0.1', 'something.local'),
                }];
                obfuscateAddress(method, e);

                const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
                expect(obfuscateAddressdCandidate.address).to.equal('something.local');
                expect(obfuscateAddressdCandidate.ip).to.equal('something.local');
            });

            it('does not obfuscate the relay address in ' + method, () => {
                const e = [method, null, {
                    sdpMid: 0,
                    candidate: relayCandidateSdp,
                }];
                obfuscateAddress(method, e);
                const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
                expect(obfuscateAddressdCandidate.address).to.equal('8.8.8.8');
                expect(obfuscateAddressdCandidate.ip).to.equal('8.8.8.8');
                expect(obfuscateAddressdCandidate.relatedAddress).to.equal('1.1.1.x');
            });
        });
    });
    describe('SDP', () => {
        it('obfuscateѕ the c= line', () => {
            const e = ['setRemoteDescription', null, {
                type: 'offer',
                sdp,
            }];
            obfuscateAddress('setRemoteDescription', e);
            expect(e[2].sdp).not.to.contain('c=IN IP4 8.8.8.8');
            expect(e[2].sdp).to.contain('c=IN IP4 0.0.0.0');
        });
        it('obfuscateѕ the a=rtcp: line', () => {
            const e = ['setRemoteDescription', null, {
                type: 'offer',
                sdp,
            }];
            obfuscateAddress('setRemoteDescription', e);
            expect(e[2].sdp).not.to.contain('a=rtcp:9 IN IP4 8.8.8.8');
            expect(e[2].sdp).to.contain('a=rtcp:9 IN IP4 0.0.0.0');
        });
        it('obfuscates candidates', () => {
            const e = ['setRemoteDescription', null, {
                type: 'offer',
                sdp: sdp + 'a=' + candidateSdp,
            }];
            obfuscateAddress('setRemoteDescription', e);
            expect(e[2].sdp).not.to.contain('192.168.0.1');
            expect(e[2].sdp).to.contain('192.168.0.x');
        });
        it('does not obfuscate relay candidates', () => {
            const e = ['setRemoteDescription', null, {
                type: 'offer',
                sdp: sdp + 'a=' + relayCandidateSdp,
            }];
            obfuscateAddress('setRemoteDescription', e);
            expect(e[2].sdp).to.contain('8.8.8.8 9 typ relay raddr 1.1.1.x');
        });
    });
    describe('getStats', () => {
        it('obfuscates address', () => {
            const e = ['getStats', null, [{
                address: '192.168.0.1',
                relatedAddress: '10.0.0.1',
                ip: '192.168.0.1',
            }]];
            obfuscateAddress('getStats', e);
            expect(e[2]).to.deep.equal([{
                address: '192.168.0.x',
                relatedAddress: '10.0.0.x',
            }]);
        });
        it('does not obfuscate relay addresses', () => {
            const e = ['getStats', null, [{
                candidateType: 'relay',
                address: '192.168.0.1',
                relatedAddress: '10.0.0.1',
                ip: '192.168.0.1',
            }]];
            obfuscateAddress('getStats', e);
            expect(e[2]).to.deep.equal([{
                candidateType: 'relay',
                address: '192.168.0.1',
                relatedAddress: '10.0.0.x',
                ip: '192.168.0.1',
            }]);
        });
    });
});
