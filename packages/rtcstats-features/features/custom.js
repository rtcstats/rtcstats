/* eslint sort-keys: "error" */

/* Custom feature extraction.
 *
 * This file is the place for deployment-specific features. It ships nearly empty and is
 * intentionally never touched by updates to this repository, so rebasing or merging a new
 * upstream version on top of a customized deployment should not conflict here.
 *
 * There are three extractors, mirroring the three built-in ones in this directory:
 *   extractCustomClientFeatures(clientTrace), called by `client.js`
 *   extractCustomConnectionFeatures(clientTrace, peerConnectionTrace), called by `connection.js`
 *   extractCustomTrackFeatures(clientTrace, peerConnectionTrace, trackInformation), called by `track.js`
 *
 * Each returns an object which is merged into the row inserted into `features_client`,
 * `features_connection` and `features_track` respectively. Returning an empty object
 * (the default) means no custom columns are written.
 *
 * Rules:
 *
 * 1. Every key MUST start with `custom`, e.g. `customConferenceId` or `customSfuRegion`.
 *    This keeps upstream free to add features without ever colliding with a custom one.
 *
 * 2. You are responsible for your own database migrations. Adding a key here does not
 *    create the column. Add a migration under `supabase/migrations/` creating the
 *    corresponding snake_case column (`customSfuRegion` becomes `custom_sfu_region`)
 *    on the right table, or the insert will fail.
 *
 * 3. Extractors must not throw and must be synchronous. Return `undefined` for a feature
 *    that does not apply to a given dump rather than throwing.
 *
 * See `../features.md` for the shape of `clientTrace`, `peerConnectionTrace` and
 * `trackInformation`, and the other files in this directory for examples.
 */

// Features describing the client as a whole, extracted from the clientTrace.
export function extractCustomClientFeatures(/* clientTrace */_) {
    return {};
}

// Features describing a single RTCPeerConnection.
export function extractCustomConnectionFeatures(/* clientTrace */_, /* peerConnectionTrace */__) {
    return {};
}

// Features describing a single inbound or outbound media track of a connection.
export function extractCustomTrackFeatures(/* clientTrace */_, /* peerConnectionTrace */__, /* trackInformation */___) {
    return {};
}
