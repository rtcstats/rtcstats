// Minimal copy of https://www.npmjs.com/package/sdp
export default class SDPUtils {
    static splitLines(blob) {
        return blob.trim().split('\n').map(line => line.trim());
    }
    static parseCandidate(line) {
        let parts;
        // Parse both variants.
        if (line.indexOf('a=candidate:') === 0) {
            parts = line.substring(12).split(' ');
        } else {
            parts = line.substring(10).split(' ');
        }

        const candidate = {
            foundation: parts[0],
            component: {1: 'rtp', 2: 'rtcp'}[parts[1]] || parts[1],
            protocol: parts[2].toLowerCase(),
            priority: parseInt(parts[3], 10),
            ip: parts[4],
            address: parts[4], // address is an alias for ip.
            port: parseInt(parts[5], 10),
            // skip parts[6] == 'typ'
            type: parts[7],
        };

        for (let i = 8; i < parts.length; i += 2) {
            switch (parts[i]) {
            case 'raddr':
                candidate.relatedAddress = parts[i + 1];
                break;
            case 'rport':
                candidate.relatedPort = parseInt(parts[i + 1], 10);
                break;
            case 'tcptype':
                candidate.tcpType = parts[i + 1];
                break;
            case 'ufrag':
                candidate.ufrag = parts[i + 1]; // for backward compatibility.
                candidate.usernameFragment = parts[i + 1];
                break;
            default: // extension handling, in particular ufrag. Don't overwrite.
                if (candidate[parts[i]] === undefined) {
                    candidate[parts[i]] = parts[i + 1];
                }
                break;
            }
        }
        return candidate;
    }

    static writeCandidate(candidate) {
        const sdp = [];
        sdp.push(candidate.foundation);

        const component = candidate.component;
        if (component === 'rtp') {
            sdp.push(1);
        } else if (component === 'rtcp') {
            sdp.push(2);
        } else {
            sdp.push(component);
        }
        sdp.push(candidate.protocol.toUpperCase());
        sdp.push(candidate.priority);
        sdp.push(candidate.address || candidate.ip);
        sdp.push(candidate.port);

        const type = candidate.type;
        sdp.push('typ');
        sdp.push(type);
        if (type !== 'host' && candidate.relatedAddress &&
            candidate.relatedPort) {
            sdp.push('raddr');
            sdp.push(candidate.relatedAddress);
            sdp.push('rport');
            sdp.push(candidate.relatedPort);
        }
        if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
            sdp.push('tcptype');
            sdp.push(candidate.tcpType);
        }
        if (candidate.usernameFragment || candidate.ufrag) {
            sdp.push('ufrag');
            sdp.push(candidate.usernameFragment || candidate.ufrag);
        }
        return 'candidate:' + sdp.join(' ');
    }
}

