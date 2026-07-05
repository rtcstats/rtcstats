/* eslint sort-keys: "error" */

export function pluckStat(statsObject, properties) {
    if (!statsObject) return;
    for (const property of properties) {
        if (statsObject.hasOwnProperty(property)) {
            return statsObject[property];
        }
    }
}

export function divideStat(statsObject, nominator, denominator) {
    if (!statsObject) return;
    if (!(statsObject.hasOwnProperty(nominator) && statsObject.hasOwnProperty(denominator))) {
        return undefined;
    }
    if (statsObject[denominator] === 0) {
        return undefined;
    }
    return statsObject[nominator] / statsObject[denominator];
}
