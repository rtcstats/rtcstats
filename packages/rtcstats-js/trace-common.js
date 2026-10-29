/**
 * Client metadata for the initial 'create' trace event (with a null pcId).
 * Trace implementations should send this as the first event.
 *
 * @returns {object} metadata.
 */
export function getClientMetadata() {
    return {
        hardwareConcurrency: navigator.hardwareConcurrency,
        userAgentData: navigator.userAgentData,
        deviceMemory: navigator.deviceMemory,
        cpuPerformance: navigator.cpuPerformance,
        screen: {
            width: window.screen?.availWidth,
            height: window.screen?.availHeight,
            devicePixelRatio: window.devicePixelRatio,
        },
        window: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
    };
}
