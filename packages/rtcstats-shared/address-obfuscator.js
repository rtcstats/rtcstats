// Obfuscate ip addresses which should not be stored long-term.
import SDPUtils from 'sdp';

// Obfuscate an IP address, keeping address family intact.
// Based on libWebRTCs IPAddress::ToSensitiveString
// https://source.chromium.org/chromium/chromium/src/+/main:third_party/webrtc/rtc_base/ip_address.cc;l=149;drc=0dc30698370bcde67dda4f48b7ca19bf4c1dbc17
function obfuscateIpOrAddress(ipOrAddress) {
    if (['::1', '127.0.0.1'].includes(ipOrAddress)) {
        return ipOrAddress;
    }
    if (ipOrAddress.indexOf(':') !== -1) { // IPv6
        const parts = ipOrAddress.split(':');
        return parts.slice(0, 3).join(':') + 'x:x:x:x:x:x';
    }
    const parts = ipOrAddress.split('.');
    if (parts.length === 4) { // IPv4
        parts[3] = 'x';
        return parts.join('.');
    } else { // A hostname.
        return ipOrAddress;
    }
}

// Obfuscate the IP in ice candidates. Does NOT obfuscate the IP of the
// TURN server to allow selecting/grouping sessions by TURN server.
function obfuscateCandidate(candidate) {
    const cand = SDPUtils.parseCandidate(candidate);
    if (cand.type !== 'relay') {
        cand.address = obfuscateIpOrAddress(cand.address);
        delete cand.ip;
    }
    if (cand.relatedAddress) {
        cand.relatedAddress = obfuscateIpOrAddress(cand.relatedAddress);
    }
    return SDPUtils.writeCandidate(cand);
}

// Obfuscate the IP in SDP, candidate lines, c= and a=rtcp lines.
function obfuscateSDP(sdp) {
    return SDPUtils.splitLines(sdp).map(line => {
        // obfuscate a=candidate, c= and a=rtcp
        if (line.startsWith('a=candidate:')) {
            return 'a=' + obfuscateCandidate(line);
        } else if (line.startsWith('c=')) {
            return 'c=IN IP4 0.0.0.0';
        } else if (line.startsWith('a=rtcp:')) {
            return 'a=rtcp:9 IN IP4 0.0.0.0';
        }
        return line;
    }).join('\r\n').trim() + '\r\n';
}

function obfuscateStats(stats) {
    Object.keys(stats).forEach((id) => {
        const report = stats[id];
        if (!report) {
            return;
        }
        if (report.address && report.candidateType !== 'relay') {
            report.address = obfuscateIpOrAddress(report.address);
            delete report.ip;
        }
        if (report.relatedAddress) {
            report.relatedAddress = obfuscateIpOrAddress(report.relatedAddress);
        }
    });
}

export function obfuscateAddress(method, data) {
    switch(method) {
    case 'addIceCandidate':
    case 'onicecandidate':
        if (data[2] && data[2].candidate) {
            data[2].candidate = obfuscateCandidate(data[2].candidate);
        }
        break;
    case 'setLocalDescription':
    case 'setLocalDescriptionOnSuccess':
    case 'setRemoteDescription':
    case 'createOfferOnSuccess':
    case 'createAnswerOnSuccess':
        if (data[2] && data[2].sdp) {
            data[2].sdp = obfuscateSDP(data[2].sdp);
        }
        break;
    case 'getStats':
        if (data[2]) {
            obfuscateStats(data[2]);
        }
        break;
    case 'publicIP':
        if (Array.isArray(data[2])) {
            data[2] = data[2].map(obfuscateIpOrAddress);
        } else {
            data[2] = obfuscateIpOrAddress(data[2]);
        }
        break;
    default:
        break;
    }
};
