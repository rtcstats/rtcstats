import {RTCStatsDumpImporter} from './import-rtcstats.js';
import {WebRTCInternalsDumpImporter} from './import-internals.js';
import {detectRTCStatsDump, detectWebRTCInternalsDump, maybeUncompressDump} from '@rtcstats/rtcstats-shared';

const container = document.getElementById('tables');
document.getElementById('import').onchange = async (evt) => {
    evt.target.disabled = 'disabled';
    document.getElementById('upload-button').disabled = true;
    document.getElementById('useReferenceTime').disabled = true;

    const useReferenceTime = document.getElementById('useReferenceTime').checked;

    const files = evt.target.files;
    const file = files[0];
    const status = document.getElementById('status');
    status.textContent = file.name;
    status.classList.add('visible');
    const blob = await maybeUncompressDump(file);
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
