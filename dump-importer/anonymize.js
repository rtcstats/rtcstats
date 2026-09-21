import {anonymizeBlob} from '../packages/rtcstats-shared/anonymize.js';
import {download, onDump, setStatus} from './upload.js';

onDump(async (blob) => {
    const anonymized = await anonymizeBlob(await blob.text());
    if (!anonymized) {
        console.error('Unrecognized format');
        setStatus('Unrecognized file format. Please use a webrtc-internals JSON dump or rtcstats dump.');
        return;
    }
    download(anonymized, 'rtcstats-obfuscated.txt');
    setStatus('Done - anonymized file downloaded.');
});
