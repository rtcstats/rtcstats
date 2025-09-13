export function createNoStorage() {
    console.log('Storage not configured, skipping');
    return {
        put: async (key, filename) => {
            console.log('Storage not configured, not uploading', filename);
        },
        get: async (blobUrl) => {
            console.log('Storage not configured, not downloading');
        },
    };
}
