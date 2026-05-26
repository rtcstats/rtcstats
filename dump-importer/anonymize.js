import {anonymizeBlob} from '../packages/rtcstats-shared/anonymize.js';

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
    const newBlob = await anonymizeBlob(await blob.text());
    if (newBlob) {
        const anchor = document.getElementById('download');
        anchor.download = 'rtcstats-obfuscated.txt';
        anchor.href = URL.createObjectURL(newBlob);
        anchor.click();
        if (statusEl) {
            statusEl.textContent = 'Done - anonymized file downloaded.';
            statusEl.classList.add('visible');
        }
    } else {
        console.error('Unrecognized format');
        if (statusEl) {
            statusEl.textContent = 'Unrecognized file format. Please use a webrtc-internals JSON dump or rtcstats dump.';
            statusEl.classList.add('visible');
        }
    }
};
