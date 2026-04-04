import {
    detectRTCStatsDump,
    detectWebRTCInternalsDump,
    readWebRTCInternalsDump,
    decompressMethod,
} from '@rtcstats/rtcstats-shared';
import {
    obfuscateAddress,
    obfuscateIpOrAddress,
} from '../packages/rtcstats-shared/address-obfuscator.js';

const area = document.getElementById('upload-area');
const fileInput = document.getElementById('import');
const statusEl = document.getElementById('status');

area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
});
area.addEventListener('dragleave', () => {
    area.classList.remove('dragover');
});
area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    fileInput.files = e.dataTransfer.files;
    fileInput.dispatchEvent(new Event('change'));
});

// Show status on file select
const origOnChange = fileInput.onchange;
fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        statusEl.textContent = 'Processing ' + fileInput.files[0].name + '...';
        statusEl.classList.add('visible');
    }
});

document.getElementById('import').onchange = async (evt) => {
    evt.target.disabled = 'disabled';

    const files = evt.target.files;
    const file = files[0];
    let stream;
    if (['application/gzip', 'application/x-gzip'].includes(file.type)) {
        stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    } else {
        stream = file.stream();
    }
    const blob = await (new Response(stream)).blob();
    const textBlob = await blob.text();
    let newBlob;
    if (await detectRTCStatsDump(blob)) {
        const lines = textBlob.split('\n').map(line => {
            if (line.startsWith('RTCStatsDump')) {
                return line;
            }
            const data = JSON.parse(line);
            obfuscateAddress(decompressMethod(data[0]), data);
            return JSON.stringify(data);
        });
        newBlob = new Blob([lines.join('\n')]);
    } else if (await detectWebRTCInternalsDump(blob)) {
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
        newBlob = new Blob([JSON.stringify(json, null, ' ')]);
    } else {
        console.error('Unrecognized format');
        if (statusEl) {
            statusEl.textContent = 'Unrecognized file format. Please use a webrtc-internals JSON dump or rtcstats dump.';
            statusEl.classList.add('visible');
        }
    }
    if (newBlob) {
        const anchor = document.getElementById('download');
        anchor.download = 'rtcstats-obfuscated.txt';
        anchor.href = URL.createObjectURL(newBlob);
        anchor.click();
        if (statusEl) {
            statusEl.textContent = 'Done - anonymized file downloaded.';
            statusEl.classList.add('visible');
        }
    }
};
