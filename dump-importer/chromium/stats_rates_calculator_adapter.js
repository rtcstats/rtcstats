import {StatsRatesCalculator} from './stats_rates_calculator.js';

// Adapter class for the Chromium StatsRatesCalculator.
export class  StatsRatesCalculatorAdapter {
    constructor() {
        this.calculator = new StatsRatesCalculator();
    }
    addGetStats(report) {
        // TODO: if any of the keys starts with '[' assume we do not have any work to do
        // as derived metrics have already been calculated.
        const statsReport = new Map();
        Object.keys(report).forEach(id => {
            statsReport.set(id, report[id]);
        });
        this.calculator.addStatsReport(statsReport);
        const entries = this.calculator.currentReport.calculatedStatsById.entries();
        const result = {}
        for (const [statsId, calculatedStats] of entries) {
            for (const [_, calculatedMetrics] of calculatedStats.calculatedMetricsByOriginalName) {
                for (const calculatedMetric of calculatedMetrics) {
                    if (!result[statsId]) {
                        result[statsId] = {};
                    }
                    result[statsId][calculatedMetric.name] = calculatedMetric.value;
                }
            }
        }
        return result;
    }
}
