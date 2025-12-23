import { openDB, deleteDB } from 'idb';

const STORE_NAME = 'rtcstats';

export function IndexedDBTrace() {
    let db;
    let lastTime = 0;
    const sessionId = `session-${Date.now()}`;

    const trace = async function(...args) {
        const now = Date.now();
        args.push(now - lastTime);
        lastTime = now;

        if (args[1] instanceof RTCPeerConnection) {
            args[1] = args[1].__rtcStatsId;
        }
        const entry = JSON.parse(JSON.stringify(args));
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.add(entry);
        await tx.done;
    };

    trace.connect = async () => {
        db = await openDB(sessionId, 1, {
            upgrade(db) {
                db.createObjectStore(STORE_NAME, { autoIncrement: true });
            },
        });
        trace('create', null, {
            hardwareConcurrency: navigator.hardwareConcurrency,
            userAgentData: navigator.userAgentData,
            deviceMemory: navigator.deviceMemory,
            screen: {
                width: window.screen.availWidth,
                height: window.screen.availHeight,
                devicePixelRatio: window.devicePixelRatio,
            },
            window: {
                width: window.innerWidth,
                height: window.innerHeight,
            },
        });
    };

    trace.close = async () => {
        if (db) {
            db.close();
        }
    };

    trace.download = async () => {
        const db = await openDB(sessionId, 1);
        const entries = await db.getAll(STORE_NAME);
        db.close();
        const data = entries.map(entry => JSON.stringify(entry)).join('\n');
        const blob = new Blob([
            'RTCStatsDump\n',
            JSON.stringify({
                fileFormat: 3,
                origin: window.location.origin,
                url: window.location.pathname,
            }) + '\n',
            data], { type: 'application/jsonl' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sessionId}.jsonl`;
        a.click();
        URL.revokeObjectURL(url);
    };

    trace.clear = async () => {
        await deleteDB(sessionId);
    };

    return trace;
}
