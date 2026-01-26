const CHUNK_SIZE = 1024 * 1024; // 1MB
const fetchWithHeaders = fetch;

export async function uploadToRtcStatsCom(file, endpoint, token) {
    console.log('UPLOADING TO', endpoint, token);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let uploadedChunks = 0;
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
        // fetchWithHeaders automatically includes the current account ID header
        const response = await fetchWithHeaders(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Chunk upload failed');
        }
        uploadedChunks++;
    }
    // Notify server to assemble
    // fetchWithHeaders automatically includes the current account ID header
    const assembleResponse = await fetchWithHeaders(endpoint, {
        method: 'POST',
        body: JSON.stringify({ fileId, assemble: true, fileName: file.name }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!assembleResponse.ok) {
        const errorData = await assembleResponse.json();
        console.error(errorData.error || 'File assembly failed');
    }
};

export function createRtcStatsUploader(config) {
    if (!config.token) return;
    if (!config.endpoint) return;
    return (file) => uploadToRtcStatsCom(file, config.endpoint, config.token);
}
