export function createTestSink() {
    let buffer = [];
    let lastTime = 0;
    return {
        trace: (...args) => {
            const now = Date.now();
            args.push(now - lastTime);
            lastTime = now;
            buffer.push(args);
        },
        reset: () => {
            const b = buffer;
            buffer = [];
            lastTime = 0;
            return b;
        },
    };
}
