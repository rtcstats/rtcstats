const CHUNK_SIZE = 1024 * 1024; // 1MB

export async function uploadToRtcStatsCom(fileHandle, name, endpoint, token, fetchFunction) {
    const {size} = await fileHandle.stat();
    // Upload individual chunks.
    const totalChunks = Math.ceil(size / CHUNK_SIZE);
    const fileId = `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(size, start + CHUNK_SIZE);
        const buffer = Buffer.allocUnsafe(end - start);
        const {bytesRead} = await fileHandle.read(buffer, 0, end - start, start);
        const formData = new FormData();
        formData.append('chunk', new Blob([buffer.subarray(0, bytesRead)]));
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', name);
        const response = await fetchFunction(endpoint, {
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
    }
    // Notify server to assemble.
    const assembleResponse = await fetchFunction(endpoint, {
        method: 'POST',
        body: JSON.stringify({ fileId, assemble: true, fileName: name }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    if (!assembleResponse.ok) {
        const errorData = await assembleResponse.json();
        console.error(errorData.error || 'File assembly failed');
        return;
    }
    return assembleResponse.json();
};

export function createRtcStatsUploader(config) {
    if (!(config.token && config.endpoint)) {
        return;
    }
    let randomPercentage = 1.0;
    if (config.randomPercentage >= 0 && config.randomPercentage < 1.0) {
        randomPercentage = config.randomPercentage;
    }
    // Only for testing.
    const fetchFunction = config.fetch || fetch;
    const randomFunction = config.random || Math.random;
    return (fileHandle, name) => {
        if (randomFunction() >= randomPercentage) {
            return;
        }
        return uploadToRtcStatsCom(fileHandle, name, config.endpoint, config.token, fetchFunction);
    };
}
