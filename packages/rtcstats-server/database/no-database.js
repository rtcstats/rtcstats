export function createNoDatabase() {
    console.log('postgres not configured, skipping');
    return {
        dump: (name, startTime, stopTime, blobUrl, metadata) => {
            console.log('Not writing to database', name, startTime, stopTime, blobUrl, metadata);
        },
        fetchUnprocessedDump: () => {},
    };
}
