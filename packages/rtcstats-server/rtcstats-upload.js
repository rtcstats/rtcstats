import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

class ExtractFileTransform extends Transform {
    constructor(boundary, options) {
        super(options);
        this.boundary = '--' + boundary;
        this.endBoundary = this.boundary + '--';

        this.state = 'start'; // start->headers->first->metadata->body
        this.buffer = '';

        this.metadata = null;
        this.numberOfMessages = 0;
    }

    _transform(chunk, encoding, callback) {
        this.buffer += chunk.toString('utf-8');

        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            // if we're done, don't process further lines
            if (this.state === 'end') {
                break;
            }
            this.processLine(line);
        }
        callback();
    }

    processLine(line) {
        switch (this.state) {
        case 'body':
            if (line === this.boundary || line === this.endBoundary) {
                this.state = 'end';
                this.push(null); // End the stream.
            } else if (line.length > 0) {
                this.push(line + '\n');
                this.numberOfMessages++;
            }
            break;
        case 'start':
            if (line === this.boundary) {
                this.state = 'headers';
            }
            break;
        case 'headers':
            if (line === '') { // Empty line after headers
                this.state = 'first';
            }
            break;
        case 'first':
            if (line !== 'RTCStatsDump') {
                return this.emit('error', new Error('Unsupported file format'));
            }
            this.push(line + '\n');
            this.state = 'metadata';
            break;
        case 'metadata':
            if (!(line.startsWith('{') && line.endsWith('}'))) {
                return this.emit('error', new Error('Unsupported file format'));
            }
            try {
                this.metadata = JSON.parse(line);
                this.emit('metadata', this.metadata);
            } catch (e) {
                return this.emit('error', e);
            }
            this.push(line + '\n');
            this.state = 'body';
            break;
        case 'end':
             // do nothing
            break;
        }
    }

    _flush(callback) {
        if (this.buffer.length > 0) {
            this.processLine(this.buffer);
        }
        if (this.state !== 'end') {
            return callback(new Error('Incomplete multipart data'));
        }
        callback();
    }
}

export async function handleFileupload(clientid, request, response, writeStream) {
    const contentType = request.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
        response.writeHead(400, { 'Content-Type': 'text/plain' });
        response.end('Bad Request: Content-Type must be multipart/form-data');
        return;
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
        response.writeHead(400, { 'Content-Type': 'text/plain' });
        response.end('Bad Request: boundary not found in Content-Type');
        return;
    }

    const extractor = new ExtractFileTransform(boundary);
    try {
        await pipeline(
            request,
            extractor,
            writeStream
        );
    } catch (error) {
        console.error('Upload pipeline failed:', error);
        if (!response.headersSent) {
            response.writeHead(400, { 'Content-Type': 'text/plain' });
            response.end(`Bad Request: ${error.message}`);
        }
        return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'Upload successful', clientid }));
    return {
        numberOfMessages: extractor.numberOfMessages,
        metadata: extractor.metadata,
    };
}
