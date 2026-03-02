import { expect } from '@esm-bundle/chai';

import {WebSocketTrace} from '../../trace-websocket.js';

const RELOAD_COUNT_KEY = 'rtcstatsReloadCount';
describe('Session reload counting', () => {
    afterEach(() => sessionStorage.clear());
    it('does not count unless configured', () => {
        const trace = new WebSocketTrace({countReloads: false});
        expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal(null);
    });

    it('counts when configured', () => {
        const trace = new WebSocketTrace({countReloads: true});
        expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal('0');
    });

    it('increments the session count', () => {
        sessionStorage.setItem(RELOAD_COUNT_KEY, 15);
        const trace = new WebSocketTrace({countReloads: true});
        expect(sessionStorage.getItem(RELOAD_COUNT_KEY)).to.equal('16');
    });
});
