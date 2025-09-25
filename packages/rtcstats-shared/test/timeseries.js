import {createInternalsTimeSeries, createRtcStatsTimeSeries} from '../timeseries.js';

describe('webrtc-internals timeseries', () => {
    it('gets transformed to the common format', () => {
        const input = {
            'CP1AiWle3t_ovSpjMG1-[bytesReceived_in_bits/s]': {
                endTime: '2025-09-25T10:04:24.377Z',
                startTime: '2025-09-25T10:04:18.088Z',
                statsType: 'candidate-pair',
                values: '[0,6414.208414645307]',
            },
            'CP1AiWle3t_ovSpjMG1-timestamp': {
                endTime: '2025-09-25T10:04:24.377Z',
                startTime: '2025-09-25T10:04:18.088Z',
                statsType: 'candidate-pair',
                values: '[1758794658088.537,1758794659086.322]',
            },
        };
        const result = createInternalsTimeSeries({stats: input});
        expect(result).to.deep.equal({
            CP1AiWle3t_ovSpjMG1: {
                type: 'candidate-pair',
                '[bytesReceived_in_bits/s]': [
                    [1758794658088.537, 0],
                    [1758794659086.322, 6414.208414645307],
                ],
                timestamp: [
                    [1758794658088.537, 1758794658088.537],
                    [1758794659086.322, 1758794659086.322],
                ],
            },
        });
    });

    it('gets transformed to the common format without timestamps', () => {
        const input = {
            'CP1AiWle3t_ovSpjMG1-[bytesReceived_in_bits/s]': {
                endTime: '2025-09-25T10:04:24.377Z',
                startTime: '2025-09-25T10:04:18.088Z',
                statsType: 'candidate-pair',
                values: '[0,6414.208414645307]',
            },
        };
        const result = createInternalsTimeSeries({stats: input});
        expect(result).to.deep.equal({
            CP1AiWle3t_ovSpjMG1: {
                type: 'candidate-pair',
                '[bytesReceived_in_bits/s]': [
                    [1758794658088, 0],
                    [1758794659088, 6414.208414645307],
                ],
            },
        });
    });
});

describe('rtcstats timeseries', () => {
    it('gets transformed to the common format', () => {
        const input = [
            {type: 'create', value: {}, time: 1758173664000},
            {type:'getStats', value: {4: {
                dataChannelsClosed: 0,
                dataChannelsOpened: 0,
                id: '4',
                timestamp: 1758173664803.813,
                type: 'peer-connection',
            }}, time: 1758173664000},
            {type:'getStats', value: {4: {
                dataChannelsClosed: 0,
                dataChannelsOpened: 0,
                id: '4',
                timestamp: 1758173685803.675,
                type: 'peer-connection',
            }}, time: 1758173685000},
        ];
        const result = createRtcStatsTimeSeries(input);
        expect(result).to.deep.equal({
            4: {
                type: 'peer-connection',
                dataChannelsClosed: [
                    [1758173664803.813, 0],
                    [1758173685803.675, null],
                    [1758173685803.675, 0],
                ],
                dataChannelsOpened: [
                    [1758173664803.813, 0],
                    [1758173685803.675, null],
                    [1758173685803.675, 0],
                ],
            }
        });
    });
});
