import {RTCStatsDumpImporter} from './import-rtcstats.js';
import {WebRTCInternalsDumpImporter} from './import-internals.js';

const container = document.getElementById('tables');
document.getElementById('import').onchange = async (evt) => {
    evt.target.disabled = 'disabled';
    document.getElementById('useReferenceTime').disabled = true;

    const files = evt.target.files;
    const file = files[0];
    let stream;
    if (file.type === 'application/gzip') {
        stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    } else {
        stream = file.stream();
    }
    const blob = await (new Response(stream)).blob();
    const magic = await blob.slice(0, 13).text();
    if (!magic.startsWith('RTCStatsDump\n')) {
        console.warn('Not a supported format, maybe webrtc-internals?');
        window.importer = new WebRTCInternalsDumpImporter(container);
        importer.process(await blob.text());
        return;
    }
    window.importer = new RTCStatsDumpImporter(container);
    importer.process(await blob.text());
};

