"use strict";
// flashradar/utils/platformProfit.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankPlatforms = rankPlatforms;
/**
 * Estimate sell time based on demand (V1 heuristic)
 */
function estimateSellTime(demand) {
    switch (demand) {
        case "HIGH":
            return 3;
        case "MEDIUM":
            return 7;
        case "LOW":
            return 14;
        default:
            return 10;
    }
}
/**
 * Core calculator
 */
function calculatePlatformResult(platform, input) {
    var _a;
    const shipping = (_a = input.shippingCost) !== null && _a !== void 0 ? _a : 0;
    const netProfit = input.resalePrice - input.buyPrice - input.estimatedFees - shipping;
    const profitMargin = netProfit / input.buyPrice;
    return {
        platform,
        resalePrice: input.resalePrice,
        estimatedFees: input.estimatedFees,
        shippingCost: shipping,
        netProfit,
        profitMargin,
        demand: input.demand,
        estimatedSellTimeDays: estimateSellTime(input.demand),
    };
}
/**
 * Rank platforms by profit, speed, and risk
 */
function rankPlatforms(input) {
    const results = [];
    if (input.amazon) {
        results.push(calculatePlatformResult("AMAZON", input.amazon));
    }
    if (input.ebay) {
        results.push(calculatePlatformResult("EBAY", input.ebay));
    }
    if (input.fb) {
        results.push(calculatePlatformResult("FB", input.fb));
    }
    if (input.mercari) {
        results.push(calculatePlatformResult("MERCARI", input.mercari));
    }
    if (results.length === 0) {
        throw new Error("At least one platform input is required");
    }
    const bestProfit = [...results].sort((a, b) => b.netProfit - a.netProfit)[0];
    const fastestSale = [...results].sort((a, b) => a.estimatedSellTimeDays - b.estimatedSellTimeDays)[0];
    const lowestRisk = [...results].sort((a, b) => {
        const demandScore = (d) => d === "HIGH" ? 3 : d === "MEDIUM" ? 2 : 1;
        return demandScore(b.demand) - demandScore(a.demand);
    })[0];
    return {
        bestProfit,
        fastestSale,
        lowestRisk,
        all: results,
    };
}
