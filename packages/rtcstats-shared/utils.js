/**
 * Transforms a maplike to a JS object. Mostly for getStats + JSON.parse(JSON.stringify())
 *
 * @protected
 * @param {Map|Object} m - Map or Javascript object.
 *
 * @returns {Object} object with the entries of the map.
 */
export function map2obj(m) {
    if (!m.entries) {
        return m;
    }
    const o = {};
    m.forEach((v, k) => {
        o[k] = v;
    });
    return o;
}

/**
 * Creates a representation of a track and its associated streams for serialization.
 *
 * @protected
 * @param {MediaStreamTrack} track - the MediaStreamTrack.
 * @param {...MediaStream} streams - the MediaStreams the track belongs to.
 *
 * @returns {String[]} - serialized representation.
 */
export function dumpTrackWithStreams(track, ...streams) {
    return [track.kind, track.id, ...streams.map(s => s.id)];
}

/**
 * Sanitizes a RTCConfiguration by hiding the TURN server credentials and
 * making the certificates serializable.
 *
 * @protected
 * @param {RTCConfiguration} config - the RTCConfiguration.
 *
 * @returns {Object} - serializable RTCConfiguration.
 */
export function copyAndSanitizeConfig(config) {
    if (!config) {
        return undefined;
    }
    const sanitizedConfig = JSON.parse(JSON.stringify(config)); // deepcopy
    // Remove TURN server credentials.
    if (sanitizedConfig && sanitizedConfig.iceServers) {
        sanitizedConfig.iceServers.forEach((server) => {
            delete server.credential;
        });
    }
    // Serialize certificates.
    if (config.certificates) {
        sanitizedConfig.certificates = config.certificates.map(cert => ({
            expires: cert.expires,
            fingerprints: cert.getFingerprints(),
        }));
    }
    return sanitizedConfig;
}

