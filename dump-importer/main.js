import {RTCStatsDumpImporter} from './import-rtcstats.js';
import {WebRTCInternalsDumpImporter} from './import-internals.js';
import {detectRTCStatsDump, detectWebRTCInternalsDump} from 'rtcstats-shared';

const container = document.getElementById('tables');
document.getElementById('import').onchange = async (evt) => {
    evt.target.disabled = 'disabled';
    document.getElementById('useReferenceTime').disabled = true;

    const useReferenceTime = document.getElementById('useReferenceTime').checked;

    const files = evt.target.files;
    const file = files[0];
    let stream;
    if (file.type === 'application/gzip') {
        stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    } else {
        stream = file.stream();
    }
    const blob = await (new Response(stream)).blob();
    if (await detectRTCStatsDump(blob)) {
        window.importer = new RTCStatsDumpImporter(container);
        importer.process(blob);
    } else if (await detectWebRTCInternalsDump(blob)) {
        window.importer = new WebRTCInternalsDumpImporter(container, {useReferenceTime});
        importer.process(blob);
    } else {
        console.error('Unrecognized format');
    }
    window.rtcStatsDumpImporterSuccess = true;
};

