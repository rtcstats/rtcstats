/* wrap navigator.getUserMedia, navigator.mediaDevices.getUserMedia
 * and navigator.mediaDevices.getDisplayMedia so that any streams
 * acquired are released after each test.
 */
beforeEach(() => {
 	const streams = [];
    const release = () => {
        streams.forEach((stream) => {
            stream.getTracks().forEach((track) => track.stop());
        });
        streams.length = 0;
    };

    if (navigator.getUserMedia) {
        const origGetUserMedia = navigator.getUserMedia.bind(navigator);
        navigator.getUserMedia = (constraints, cb, eb) => {
            origGetUserMedia(constraints, (stream) => {
                streams.push(stream);
                if (cb) {
                    cb.apply(null, [stream]);
                }
            }, eb);
        };
        navigator.getUserMedia.restore = () => {
            navigator.getUserMedia = origGetUserMedia;
            release();
        };
    }

    ['getUserMedia', 'getDisplayMedia'].forEach(method => {
        const origMethod =
                navigator.mediaDevices[method].bind(navigator.mediaDevices);
        navigator.mediaDevices[method] = (constraints) => {
            return origMethod(constraints)
                .then((stream) => {
                    streams.push(stream);
                    return stream;
                });
        };
        navigator.mediaDevices[method].restore = () => {
            navigator.mediaDevices[method] = origMethod;
            release();
        };
    });
});

afterEach(() => {
    if (navigator.getUserMedia && navigator.getUserMedia.restore) {
        navigator.getUserMedia.restore();
    }
    ['getUserMedia', 'getDisplayMedia'].forEach(method => {
        if (navigator.mediaDevices[method].restore) {
            navigator.mediaDevices[method].restore();
        }
    });
});
