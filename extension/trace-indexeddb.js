const DB_NAME = 'rtcstats';
const STORE_NAME = 'traces';
const DB_VERSION = 1;

// Minimal promise wrappers around the callback-based IndexedDB API.
const pm = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});
const txDone = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
});
// Collects the distinct index key values (sessionIds) without loading entries.
const collectIndexKeys = (index) => new Promise((resolve, reject) => {
    const keys = new Set();
    const req = index.openKeyCursor();
    req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
            keys.add(cursor.key);
            cursor.continue();
        } else {
            resolve(Array.from(keys));
        }
    };
    req.onerror = () => reject(req.error);
});
const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { autoIncrement: true });
            store.createIndex('sessionId', 'sessionId');
        }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

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
        tx.objectStore(STORE_NAME).add({ sessionId, entry });
        await txDone(tx);
    };

    trace.connect = async (sid) => {
        sessionId = sid;
        db = await openDB();
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
        const tempDb = await openDB();
        const tx = tempDb.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('sessionId');
        const entries = await pm(index.getAll(sid));
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
        const tempDb = await openDB();
        const tx = tempDb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const keys = await pm(store.index('sessionId').getAllKeys(IDBKeyRange.only(sid)));
        keys.forEach(key => store.delete(key));
        await txDone(tx);
        tempDb.close();
    };

    trace.listSessions = async() => {
        const tempDb = await openDB();
        if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
            tempDb.close();
            return [];
        }
        const tx = tempDb.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('sessionId');
        const sessionIds = await collectIndexKeys(index);
        tempDb.close();
        return sessionIds;
    };

    return trace;
}
