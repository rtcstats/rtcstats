import {splitDump} from './split-dump.js';
import {download, onDump, setStatus} from './upload.js';

const originsEl = document.getElementById('origins');
const originListEl = document.getElementById('origin-list');
const saveEl = document.getElementById('save');
const selectionEl = document.getElementById('selection');

function formatSize(bytes) {
    return bytes > 1024 * 1024 ?
        (bytes / (1024 * 1024)).toFixed(1) + ' MB' :
        Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function updateSelection() {
    const selected = [...originListEl.querySelectorAll('input:checked')];
    const bytes = selected.reduce((total, input) => total + Number(input.dataset.bytes), 0);
    saveEl.disabled = !selected.length;
    selectionEl.textContent = selected.length ? 'Selected: ' + formatSize(bytes) : 'Nothing selected.';
}

function showOrigins(dump) {
    originListEl.textContent = '';
    dump.origins.forEach((origin, index) => {
        const row = document.createElement('div');
        row.className = 'origin';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        // An origin with no peer connection is not what anyone is debugging.
        checkbox.checked = origin.connections > 0;
        checkbox.id = 'origin-' + index;
        checkbox.value = origin.origin;
        checkbox.dataset.bytes = origin.bytes;
        row.appendChild(checkbox);

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;

        const name = document.createElement('div');
        name.className = 'origin-name';
        name.textContent = origin.origin;
        label.appendChild(name);

        const detail = document.createElement('div');
        detail.className = 'origin-detail';
        detail.textContent = [
            origin.connections + (origin.connections === 1 ? ' peer connection' : ' peer connections'),
            origin.getUserMediaCalls ?
                origin.getUserMediaCalls +
                    (origin.getUserMediaCalls === 1 ? ' getUserMedia call' : ' getUserMedia calls') : '',
            origin.events + ' events',
            formatSize(origin.bytes),
        ].filter(part => part).join(', ');
        label.appendChild(detail);

        for (const trace of origin.traces) {
            const traceEl = document.createElement('div');
            traceEl.className = 'origin-detail';
            traceEl.textContent = trace.id + ': ' + (Number.isFinite(trace.start) ?
                new Date(trace.start).toLocaleString() + ' to ' +
                    new Date(trace.end).toLocaleTimeString() :
                'no timestamps');
            label.appendChild(traceEl);
        }

        row.appendChild(label);
        originListEl.appendChild(row);
    });
    originsEl.classList.add('visible');
    updateSelection();
}

originListEl.addEventListener('change', updateSelection);

let currentDump;
let currentName = 'dump';

onDump(async (blob, name) => {
    const dump = await splitDump(blob);
    if (!dump) {
        console.error('Unrecognized format');
        setStatus('Unrecognized file format. Please use a webrtc-internals JSON dump or rtcstats dump.');
        return;
    }
    if (!dump.origins.length) {
        setStatus('This dump has no per-origin data, nothing to split.');
        return;
    }
    currentDump = dump;
    currentName = name.replace(/\.gz$/, '').replace(/\.(json|jsonl|txt)$/, '');
    showOrigins(dump);
    setStatus([
        dump.origins.length === 1 ?
            'One origin found.' :
            dump.origins.length + ' origins found, select the ones to keep.',
        dump.origins.some(origin => !origin.connections) ?
            'Origins without a peer connection are unselected.' : '',
    ].filter(part => part).join(' '));
    window.rtcStatsDumpSplitterSuccess = true;
});

saveEl.onclick = () => {
    const origins = [...originListEl.querySelectorAll('input:checked')].map(input => input.value);
    const suffix = origins.length === 1 ?
        origins[0].replace(/^\w+:\/\//, '').replace(/[^\w.-]+/g, '-') : 'split';

    download(currentDump.build(origins), currentName + '-' + suffix + currentDump.extension);
    setStatus('Done - file downloaded.');
};
