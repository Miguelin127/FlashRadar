"use strict";
// flashradar/utils/flipVerdict.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlipVerdict = getFlipVerdict;
function getFlipVerdict(input) {
    const { buyPrice, netProfit, historicalLow, currentPrice, demand, dealOrigin, priceTrendingDown = false, } = input;
    const profitMargin = netProfit / buyPrice;
    // 🔥 HARD OVERRIDE — Pricing Error
    if (dealOrigin === "PRICING_ERROR") {
        return {
            verdict: "BUY",
            confidence: "HIGH",
            reason: "Pricing anomaly detected",
        };
    }
    // ❌ HARD SKIP CONDITIONS (non-negotiable)
    if (netProfit < 10 ||
        profitMargin < 0.15 ||
        demand === "LOW" ||
        dealOrigin === "SLOW_SELLER" ||
        dealOrigin === "OBSOLETE") {
        return {
            verdict: "SKIP",
            confidence: "LOW",
            reason: "Low margin or weak demand",
        };
    }
    // ⏳ DOWNTREND → WAIT (important change)
    if (priceTrendingDown && netProfit >= 15) {
        return {
            verdict: "WAIT",
            confidence: "MEDIUM",
            reason: "Price still trending down — better entry likely",
        };
    }
    // ✅ BUY CONDITIONS
    const nearHistoricalLow = currentPrice <= historicalLow * 1.05;
    if ((netProfit >= 20 || profitMargin >= 0.25) &&
        nearHistoricalLow &&
        (demand === "HIGH" || demand === "MEDIUM")) {
        return {
            verdict: "BUY",
            confidence: demand === "HIGH" ? "HIGH" : "MEDIUM",
            reason: "Strong margin near historical low",
        };
    }
    // ⏳ GENERAL WAIT
    if (netProfit >= 15) {
        return {
            verdict: "WAIT",
            confidence: "MEDIUM",
            reason: "Decent margin — timing could improve",
        };
    }
    // Default fallback
    return {
        verdict: "SKIP",
        confidence: "LOW",
        reason: "Does not meet flip thresholds",
    };
}
