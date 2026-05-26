import {decompressMethod} from './compression.js';
import {obfuscateAddress, obfuscateIpOrAddress} from './address-obfuscator.js';

// Anonymize addresses in either an rtcstats dump or a webrtc-internals JSON
// dump (passed as text). Returns a Blob with the anonymized contents in the
// same format, or undefined if the format is not recognized.
export function anonymizeBlob(textBlob) {
    if (textBlob.startsWith('RTCStatsDump\n')) {
        const lines = textBlob.split('\n').map(line => {
            if (line.startsWith('RTCStatsDump') || line === '') {
                return line;
            }
            const data = JSON.parse(line);
            obfuscateAddress(decompressMethod(data[0]), data);
            return JSON.stringify(data);
        });
        return new Blob([lines.join('\n')]);
    } else if (textBlob.startsWith('{')) {
        const json = JSON.parse(textBlob);
        Object.keys(json.PeerConnections).forEach(id => {
            const pc = json.PeerConnections[id];
            Object.keys(pc.stats).forEach(statsId => {
                const stats = pc.stats[statsId];
                const parts = statsId.split('-');
                const type = parts[parts.length - 1];
                if (!['address', 'ip', 'relatedAddress'].includes(type)) return;
                const values = JSON.parse(stats.values);
                stats.values = JSON.stringify(values.map(obfuscateIpOrAddress));
            });
            pc.updateLog.forEach(traceEvent => {
                if (!traceEvent.value) return;
                const value = JSON.parse(traceEvent.value);
                obfuscateAddress(traceEvent.type, [,, value]);
                traceEvent.value = JSON.stringify(value);
            });
        });
        return new Blob([JSON.stringify(json, null, ' ')]);
    }
}
