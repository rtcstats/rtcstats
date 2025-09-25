import {StatsRatesCalculator} from './stats_rates_calculator.js';

// Adapter class for the Chromium StatsRatesCalculator.
export class StatsRatesCalculatorAdapter {
    constructor() {
        this.calculator = new StatsRatesCalculator();
    }
    addGetStats(report) {
        // TODO: if any of the keys starts with '[' assume we do not have any work to do
        // as derived metrics have already been calculated.
        const statsReport = new Map();
        Object.keys(report).forEach(id => {
            report[id].id = id;
            statsReport.set(id, report[id]);
        });
        this.calculator.addStatsReport(statsReport);
        const result = {}
        for (const [id, report] of this.calculator.currentReport.entries()) {
            result[id] = report;
        }
        return result;
    }
}
