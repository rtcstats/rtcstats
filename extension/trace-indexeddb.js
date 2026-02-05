import { openDB } from 'idb';

const DB_NAME = 'rtcstats';
const STORE_NAME = 'traces';
const DB_VERSION = 1;

export function IndexedDBTrace() {
    let db;
    let lastTime = 0;
    let sessionId;
    const trace = async function(...args) {
        if (!db) {
            return;
        }
        const now = Date.now();
        args.push(now - lastTime);
        lastTime = now;

        if (args[1] instanceof RTCPeerConnection) {
            args[1] = args[1].__rtcStatsId;
        }
        const entry = JSON.parse(JSON.stringify(args));
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        await store.add({ sessionId, entry });
        await tx.done;
    };

    trace.connect = async (sid) => {
        sessionId = sid;
        db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
                    store.createIndex('sessionId', 'sessionId');
                }
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
            db = undefined;
        }
    };

    trace.getSessionBlob = async (sid) => {
        const tempDb = await openDB(DB_NAME, DB_VERSION);
        const entries = await tempDb.getAllFromIndex(STORE_NAME, 'sessionId', sid);
        tempDb.close();
        const data = entries.map(entry => JSON.stringify(entry.entry)).join('\n');
        return new Blob([
            'RTCStatsDump\n',
            JSON.stringify({
                fileFormat: 3,
                origin: window.location.origin,
                url: window.location.pathname,
            }) + '\n',
            data], { type: 'application/jsonl' });
    };

    trace.removeSession = async (sid) => {
        const tempDb = await openDB(DB_NAME, DB_VERSION);
        const tx = tempDb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('sessionId');
        let cursor = await index.openCursor(IDBKeyRange.only(sid));
        while (cursor) {
            await store.delete(cursor.primaryKey);
            cursor = await cursor.continue();
        }
        await tx.done;
        tempDb.close();
    };

    trace.listSessions = async() => {
        const tempDb = await openDB(DB_NAME, DB_VERSION);
        if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
            tempDb.close();
            return [];
        }
        const tx = tempDb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('sessionId');

        const sessionIds = new Set();
        let cursor = await index.openKeyCursor();
        while (cursor) {
            sessionIds.add(cursor.key);
            cursor = await cursor.continue();
        }
        tempDb.close();
        return Array.from(sessionIds);
    };

    return trace;
}
