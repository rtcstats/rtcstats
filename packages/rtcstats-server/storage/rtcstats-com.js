const CHUNK_SIZE = 1024 * 1024; // 1MB

export async function uploadToRtcStatsCom(file, endpoint, token, fetchFunction) {
    // Upload individual chunks.
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);
        const formData = new FormData();
        formData.append('chunk', new Blob([chunk]));
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('fileName', file.name);
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
    if (!(config.token && config.endpoint)) {
        return;
    }
    let randomPercentage = 0.0;
    if (config.randomPercentage && config.randomPercentage >= 0 && config.randomPercentage < 1.0) {
        randomPercentage = config.randomPercentage;
    }
    // Only for testing.
    const fetchFunction = config.fetch || fetch;
    return (file) => {
        if (config.randomPercentage === 0 || Math.random() < randomPercentage) {
            return;
        }
        uploadToRtcStatsCom(file, config.endpoint, config.token, fetchFunction);
    };
}
