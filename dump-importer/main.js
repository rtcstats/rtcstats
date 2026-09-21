import {RTCStatsDumpImporter} from './import-rtcstats.js';
import {WebRTCInternalsDumpImporter} from './import-internals.js';
import {detectRTCStatsDump, detectWebRTCInternalsDump} from '@rtcstats/rtcstats-shared';
import {onDump, setStatus} from './upload.js';

const container = document.getElementById('tables');

onDump(async (blob, name) => {
    const referenceTime = document.getElementById('useReferenceTime');
    const useReferenceTime = referenceTime.checked;
    referenceTime.disabled = true;
    setStatus(name);

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
});
