export function createNoDatabase() {
    console.log('postgres not configured, skipping');
    return {
        insert: (startTime, authData, hostIdentifier) => {
            console.log('Not inserting into database', startTime, authData, hostIdentifier);
            return 'no-id';
        },
        update: (id, stopTime, blobUrl) => {
            console.log('Not updating database', id, stopTime, blobUrl);
        },
    };
}
