import {statsCompression, statsDecompression} from '../compression.js';
import {compressMethod, decompressMethod,
    compressStatsProperty, decompressStatsProperty,
    compressStatsType, decompressStatsType
} from '../compression.js';
import {descriptionCompression, descriptionDecompression} from '../compression.js';

const timestampProperty = compressStatsProperty('timestamp');
const localCertificateIdProperty = compressStatsProperty('localCertificateId');
const remoteCertificateIdProperty = compressStatsProperty('remoteCertificateId');
const codecIdProperty = compressStatsProperty('codecId');

describe('compression', () => {
    let idMap;
    beforeEach(() => {
        idMap = {id: 'id', id1: 'id1', id2: 'id2'}; //  identity mapping for id compression.
    });
    it('compresses identical input to an empty object', () => {
        const notStats = {id: {a: 1}};
        const delta = statsCompression(notStats, notStats, idMap);
        expect(delta).to.deep.equal({});
    });

    describe('handles timestamps', () => {
        it('by moving the largest to the top level', () => {
            const baseStats = {
                id1: {
                    timestamp: 3,
                    someting: 'abc',
                },
                id2: {
                    timestamp: 1,
                    otherthing: 'def',
                }
            };
            const delta = statsCompression({}, baseStats, idMap);
            expect(delta[timestampProperty]).to.equal(baseStats['id1'].timestamp);
            expect(delta['id1'][timestampProperty]).to.equal(undefined);
            expect(delta['id2'][timestampProperty]).to.equal(1);
        });
    });

    describe('of object values', () => {
        const baseStats = {id: {
            qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 2.93, none:0.073},
            timestamp: 1,
        }};
        const secondStats = {id: {
            qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 2.93, none:0.073},
            timestamp: 2,
        }};

        it('handles objects', () => {
            const delta = statsCompression({}, baseStats, idMap);
            expect(delta['id'].qualityLimitationDurationsCustom)
                .to.deep.equal(baseStats['id'].qualityLimitationDurationsCustom);
        });

        it('removes identical values and the empty key', () => {
            const delta = statsCompression(baseStats, secondStats, idMap);
            expect(delta['id']).to.equal(undefined);
            expect(delta[timestampProperty]).to.equal(2);
        });

        it('handles additions', () => {
            const thirdStats = {id: {
                qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 3.00, none: 0.073, newthing:0.1},
            }};
            const delta = statsCompression(secondStats, thirdStats, idMap);
            expect(delta['id'].qualityLimitationDurationsCustom).to.deep.equal({
                bandwidth: 3.00,
                newthing: 0.1,
            });
        });
    });

    describe('of array values', () => {
        const baseStats = {id: {
            trackIdsCustom: [ 'S3' ],
            timestamp: 1,
        }};

        it('handles arrays', () => {
            const delta = statsCompression({}, baseStats, idMap);
            expect(delta['id'].trackIdsCustom).to.deep.equal(baseStats['id'].trackIdsCustom);
        });

        it('includes the full array on delta changes', () => {
            const newStats = {id: {
                trackIdsCustom: [ 'S3', 'S4' ],
                timestamp: 2,
            }};
            const delta = statsCompression(baseStats, newStats, idMap);
            expect(delta['id'].trackIdsCustom).to.deep.equal(newStats['id'].trackIdsCustom);
        });

        it('includes nothing if the array is the same', () => {
            const newStats = {id: {
                trackIdsCustom: [ 'S3' ],
                somethingElse: 34,
                timestamp: 2,
            }};
            const delta = statsCompression(baseStats, newStats, idMap);
            expect(delta['id'].trackIdsCustom).to.equal(undefined);
        });
    });

    describe('of ids', () => {
        it('replaces ids', () => {
            const stats = {
                id1: {
                    some: 'value',
                    timestamp: 1,
                },
                id2: {
                    timestamp: 1,
                    other: 'value',
                },
            };
            const idMap = {};
            const delta = statsCompression({}, stats, idMap);
            expect(idMap).to.deep.equal({id1: '0', id2: '1'});
        });
        it('keeps references intact', () => {
            const stats = {
                id1: {
                    someId: 'id2',
                    timestamp: 1,
                },
                id2: {
                    timestamp: 1,
                    other: 'value',
                },
            };
            const idMap = {};
            const delta = statsCompression({}, stats, idMap);
            expect(delta[idMap['id1']].someId).to.equal(idMap['id2']);
        });
    });

    describe('of objects that disappear', () => {
        it('gets compressed to a "null" report', () => {
            const stats = {
                id1: {
                    type: 'transport',
                    timestamp: 1,
                    bytesSent: 23,
                },
                id2: {
                    type: 'transport',
                    timestamp: 1,
                },
            };
            const stats2 = {
                id1: {
                    type: 'transport',
                    timestamp: 2,
                    bytesSent: 24,
                },
            };
            const idMap = {id1: 'id1', id2: 'id2'};
            const result = statsCompression(stats, stats2, idMap);
            expect(result[idMap['id2']]).to.equal(null);
        });
    });
});

describe('decompression', () => {
    let idMap;
    beforeEach(() => {
        idMap = {id: 'id', id1: 'id1', id2: 'id2'}; //  identity mapping for id compression.
    });
    it('decompresses an empty object to base stats', () => {
        const compressed = {id: {a: 1}};
        const restored = statsDecompression({}, compressed);
        expect(restored).to.deep.equal(compressed);
    });

    describe('handles timestamps', () => {
        it('by pulling from the top level', () => {
            const compressed = {
                [timestampProperty]: 3,
                id1: {
                    something: 'abc',
                },
                id2: {
                    [timestampProperty]: 1,
                    otherthing: 'def',
                }
            };

            const restored = statsDecompression({}, compressed);
            expect(restored).to.deep.equal({
                id1: {
                    timestamp: 3,
                    something: 'abc',
                },
                id2: {
                    timestamp: 1,
                    otherthing: 'def',
                }
            });
        });
    });
    describe('of object values', () => {
        const baseStats = {id: {
            qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 2.93, none:0.073},
            timestamp: 1,
        }};
        const secondStats = {id: {
            qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 2.93, none:0.073},
            timestamp: 2,
        }};

        it('handles objects', () => {
            const restored = statsDecompression({}, baseStats);
            expect(restored).to.deep.equal(baseStats);
        });

        it('removes identical values and the empty key', () => {
            const delta = statsCompression(baseStats, secondStats, {});
            const restored = statsDecompression(baseStats, delta);
            expect(restored).to.deep.equal(secondStats);
        });

        it('handles additions', () => {
            const thirdStats = {id: {
                qualityLimitationDurationsCustom: {other:0, cpu:0, bandwidth: 3.00, none:0.073, newthing: 0.1},
                timestamp: 3,
            }};
            const delta = statsCompression(secondStats, thirdStats, idMap);
            const restored = statsDecompression(secondStats, delta);
            expect(restored).to.deep.equal(thirdStats);
        });
    });
    describe('of array values', () => {
        const baseStats = {id: {
            trackIdsCustom: [ 'S3' ],
            timestamp: 1,
        }};
        const secondStats = {id: {
            trackIdsCustom: [ 'S3', 'S4' ],
            timestamp: 2,
        }};

        it('handles arrays', () => {
            const restored = statsDecompression({}, baseStats);
            expect(restored).to.deep.equal(baseStats);
        });

        it('handles full overwrites', () => {
            const delta = statsCompression(baseStats, secondStats, idMap);
            const restored = statsDecompression(baseStats, delta);
            expect(restored).to.deep.equal(secondStats);
        });
    });
    it('handles null values for disappearing objects', () => {
        const baseStats = {
            id1: {
                type: 'transport',
                timestamp: 1,
                bytesSent: 23,
            },
            id2: {
                type: 'transport',
                timestamp: 1,
            },
        };
        const delta = {
            id1: {
                bytesSent: 24,
            },
            id2: null,
            timestamp: 2,
        };
        const restored = statsDecompression(baseStats, delta);
        expect(restored['id2']).to.equal(undefined);
    });
});

describe('method compression', () => {
    it('compresses known methods', () => {
        const compressedMethod = compressMethod('createOffer');
        expect(compressedMethod).not.to.equal('createOffer');
        expect(compressedMethod).to.be.a('number');
    });
    it('compresses unknown methods (to their value)', () => {
        const compressedMethod = compressMethod('unknown');
        expect(compressedMethod).not.to.be.a('number');
        expect(compressedMethod).to.equal('unknown');
    });

    it('decompresses known methods', () => {
        const compressedMethod = compressMethod('createOffer');
        const decompressedMethod = decompressMethod(compressedMethod);
        expect(decompressedMethod).to.equal('createOffer');
    });
    it('decompresses unknown methods (to their values', () => {
        const compressedMethod = compressMethod('unknown');
        const decompressedMethod = decompressMethod(compressedMethod);
        expect(decompressedMethod).to.equal('unknown');
    });
});

describe('stats type compression', () => {
    it('compresses known types', () => {
        const compressedType = compressStatsType('outbound-rtp');
        expect(compressedType).not.to.equal('outbound-rtp');
        expect(compressedType).to.be.a('number');
    });
    it('compresses unknown types (to their value)', () => {
        const compressedType = compressStatsType('unknown');
        expect(compressedType).not.to.be.a('number');
        expect(compressedType).to.equal('unknown');
    });

    it('decompresses known methods', () => {
        const compressedType = compressStatsType('outbound-rtp');
        const decompressedType = decompressStatsType(compressedType);
        expect(decompressedType).to.equal('outbound-rtp');
    });
    it('decompresses unknown methods (to their values', () => {
        const compressedType = compressStatsType('unknown');
        const decompressedType = decompressStatsType(compressedType);
        expect(decompressedType).to.equal('unknown');
    });
    it('works end-to-end', () => {
        const stats = {
            'OT01A3572743119': {
                'type': 'outbound-rtp',
                'codecId': 'COT01_111_minptime=10;useinbandfec=1',
            },
        };
        const delta = statsCompression({}, stats, {OT01A3572743119: 'OT01A3572743119'});
        expect(delta['OT01A3572743119'].type).to.equal(compressStatsType('outbound-rtp'));
    });
});

describe('stat property compression', () => {
    it('compresses known properties', () => {
        const compressedProperty = compressStatsProperty('transportId');
        expect(compressedProperty).not.to.equal('transportId');
        expect(compressedProperty).to.be.a('number');
    });
    it('compresses unknown properties (to their value)', () => {
        const compressedProperty = compressStatsProperty('unknown');
        expect(compressedProperty).not.to.be.a('number');
        expect(compressedProperty).to.equal('unknown');
    });

    it('decompresses known properties', () => {
        const compressedProperty = compressStatsProperty('transportId');
        const decompressedProperty = decompressStatsProperty(compressedProperty);
        expect(decompressedProperty).to.equal('transportId');
    });
    it('decompresses unknown methods (to their values', () => {
        const compressedProperty = compressStatsProperty('unknown');
        const decompressedProperty = decompressStatsProperty(compressedProperty);
        expect(decompressedProperty).to.equal('unknown');
    });
    it('works end-to-end', () => {
        const stats = {
            'OT01A3572743119': {
                'type': 'outbound-rtp',
                'transportId': 'someTransport',
            },
        };
        const delta = statsCompression({}, stats, {OT01A3572743119: 'OT01A3572743119'});
        expect(delta['OT01A3572743119'][compressStatsProperty('transportId')]).to.equal('someTransport');
    });
});

describe('certificate removal', () => {
    const stats = {
        'CFlongid1': {
            'id': 'CFlongid1',
            'type': 'certificate',
            'base64Certificate': 'longstring',
            'fingerprint': 'longstring',
            'fingerprintAlgorithm': 'sha-256'
        },
        'CFlongid2': {
            'id': 'CFlongid2',
            'type': 'certificate',
            'base64Certificate': 'longstring',
            'fingerprint': 'longstring',
            'fingerprintAlgorithm': 'sha-256'
        },
        'T01': {
            'id': 'T01',
            'timestamp': 1748528601063.845,
            'type': 'transport',
            'localCertificateId': 'CFlongid1',
            'remoteCertificateId': 'CFlongid2',
        }
    };
    it('removes the certificates', () => {
        const delta = statsCompression({}, stats, {});
        let found = false;
        Object.keys(delta).forEach(id => {
            const report = delta[id];
            if (report.type === 'certificate') {
                found = true;
            }
        });
        expect(found).to.equal(false);
    });
    it('removes the references to the certificates', () => {
        const delta = statsCompression({}, stats, {});
        let transportId;
        Object.keys(delta).forEach(id => {
            const report = delta[id];
            if (report.type === compressStatsType('transport')) {
                transportId = id;
            }
        });
        expect(transportId).not.to.equal(undefined);
        expect(delta[transportId]).not.to.equal(undefined);
        expect(delta[transportId][localCertificateIdProperty]).to.equal(undefined);
        expect(delta[transportId][remoteCertificateIdProperty]).to.equal(undefined);
    });
});

describe('obsolete property removal', () => {
    const stats = {id: {
        isRemote: true,
        ip: '127.0.0.1',
        mediaType: 'audio',
        writable: true,
    }};
    it('are removed', () => {
        const idMap = {};
        const delta = statsCompression({}, stats, idMap);
        expect(delta).to.deep.equal({[idMap['id']]: {}});
    });
});

describe('SDP compression', () => {
    const initialSdp = `v=0
o=- 3278290563440185418 4 IN IP4 127.0.0.1
s=-
t=0 0
a=extmap-allow-mixed
`.split('\n').join('\r\n');
    const datachannelSdp = `m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:faYd
a=ice-pwd:Z9HWqbmZw5GC110s9vWP54V8
a=ice-options:trickle
a=fingerprint:sha-256 BC:70:70:75:6C:11:E3:FF:BB:92:F8:F1:6F:D8:D7:06:8A:DE:D6:B3:58:9B:58:0F:D8:63:F4:CF:8A:D1:C2:0C
a=setup:actpass
a=mid:0
a=sctp-port:5000
a=max-message-size:262144
`.split('\n').join('\r\n');

    describe('compresses', () => {
        it('the first section to `v=CRLF`', () => {
            const compressed = descriptionCompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'offer', sdp: initialSdp}
            );
            expect(compressed).to.be.an('object');
            expect(compressed.sdp).to.equal('v=\r\n');
        });

        it('identical media sections to m=', () => {
            const compressed = descriptionCompression(
                {type: 'offer', sdp: initialSdp + datachannelSdp},
                {type: 'offer', sdp: initialSdp + datachannelSdp}
            );
            expect(compressed).to.be.an('object');
            expect(compressed.sdp).to.equal('v=\r\nm=\r\n');
        });

        it('with an added m-line', () => {
            const compressed = descriptionCompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'offer', sdp: initialSdp + datachannelSdp}
            );
            expect(compressed).to.be.an('object');
            expect(compressed.sdp).to.equal('v=\r\n' + datachannelSdp);
        });

        it('with missing base SDP', () => {
            const compressed = descriptionCompression(
                null,
                {type: 'offer', sdp: initialSdp}
            );
            expect(compressed).to.be.an('object');
            expect(compressed.sdp).to.equal(initialSdp);
        });

        it('with missing new SDP', () => {
            const compressed = descriptionCompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'rollback'}
            );
            expect(compressed).to.be.an('object');
            expect(compressed.sdp).to.equal(undefined);
        });
    });

    describe('decompresses', () => {
        it('the first section', () => {
            const restored = descriptionDecompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'offer', sdp: 'v=\r\n'}
            );
            expect(restored).to.be.an('object');
            expect(restored.sdp).to.equal(initialSdp);
        });

        it('identical media sections from m=', () => {
            const restored = descriptionDecompression(
                {type: 'offer', sdp: initialSdp + datachannelSdp},
                {type: 'offer', sdp: 'v=\r\nm=\r\n'}
            );
            expect(restored).to.be.an('object');
            expect(restored.sdp).to.equal(initialSdp + datachannelSdp);
        });

        it('with an additional m-line', () => {
            const restored = descriptionDecompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'offer', sdp: 'v=\r\n' + datachannelSdp}
            );
            expect(restored).to.be.an('object');
            expect(restored.sdp).to.equal(initialSdp + datachannelSdp);
        });

        it('with missing base SDP', () => {
            const restored = descriptionDecompression(
                null,
                {type: 'offer', sdp: initialSdp}
            );
            expect(restored).to.be.an('object');
            expect(restored.sdp).to.equal(initialSdp);
        });

        it('with missing new SDP', () => {
            const restored = descriptionDecompression(
                {type: 'offer', sdp: initialSdp},
                {type: 'rollback'}
            );
            expect(restored).to.be.an('object');
            expect(restored.sdp).to.equal(undefined);
        });
    });
});
