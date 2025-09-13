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
c=IN IP4 0.0.0.0
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
    ['onicecandidate', 'addIceCandidate'].forEach(method => {
        it('obfuscateAddresѕ IPv4 addresses in ' + method, () => {
            const e = [method, null, {
                sdpMid: 0,
                candidate: candidateSdp,
            }];
            obfuscateAddress(method, e);

            const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
            expect(obfuscateAddressdCandidate.address).to.equal('192.168.0.x');
            expect(obfuscateAddressdCandidate.ip).to.equal('192.168.0.x');
        });

        it('obfuscateAddressѕ IPv6 addresses in ' + method, () => {
            const e = [method, null, {
                sdpMid: 0,
                candidate: candidateSdp.replace('192.168.0.1', '2001:DB8::8:800:200C:417A'),
            }];
            obfuscateAddress(method, e);

            const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
            expect(obfuscateAddressdCandidate.address).to.equal('2001:DB8:x:x:x:x:x:x');
            expect(obfuscateAddressdCandidate.ip).to.equal('2001:DB8:x:x:x:x:x:x');
        });

        it('does not obfuscateAddress hostnames in ' + method, () => {
            const e = [method, null, {
                sdpMid: 0,
                candidate: candidateSdp.replace('192.168.0.1', 'something.local'),
            }];
            obfuscateAddress(method, e);

            const obfuscateAddressdCandidate = SDPUtils.parseCandidate(e[2].candidate);
            expect(obfuscateAddressdCandidate.address).to.equal('something.local');
            expect(obfuscateAddressdCandidate.ip).to.equal('something.local');
        });

        it('does not obfuscateAddress the relay address in ' + method, () => {
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
