import {maybeUncompressDump} from '@rtcstats/rtcstats-shared';

const area = document.getElementById('upload-area');
const fileInput = document.getElementById('import');
const uploadButton = area.querySelector('.upload-button');
const statusEl = document.getElementById('status');

export function setStatus(text) {
    statusEl.textContent = text;
    statusEl.classList.add('visible');
}

export function download(blob, name) {
    const anchor = document.getElementById('download');
    anchor.download = name;
    anchor.href = URL.createObjectURL(blob);
    anchor.click();
    URL.revokeObjectURL(anchor.href);
}

// Turn the upload area into a drop target and hand the uncompressed dump to
// the tool that imported this. Every tool takes one dump per page load.
export function onDump(load) {
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
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        // A drop sets the files and dispatches the event itself, which a
        // disabled input does not stop.
        if (!file || fileInput.disabled) {
            return;
        }
        fileInput.disabled = true;
        uploadButton.disabled = true;
        setStatus('Processing ' + file.name + '...');
        await load(await maybeUncompressDump(file), file.name);
    };
}
