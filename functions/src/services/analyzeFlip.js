"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeFlip = analyzeFlip;
const priceHistory_1 = require("../utils/priceHistory");
const platformProfit_1 = require("../utils/platformProfit");
const flipVerdict_1 = require("../utils/flipVerdict");
const dealOriginScore_1 = require("../utils/dealOriginScore");
/**
 * Env-safe ID generator (Expo / Node / RN / Firebase)
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function analyzeFlip(input) {
    const { userId, title, buyPrice, priceHistory, platformInputs, demand, dealOrigin, source, } = input;
    // 1️⃣ Analyze price history
    const priceAnalysis = (0, priceHistory_1.analyzePriceHistory)(priceHistory);
    // 2️⃣ Rank platforms
    const platformRanking = (0, platformProfit_1.rankPlatforms)(platformInputs);
    const bestPlatform = platformRanking.bestProfit;
    // 3️⃣ Profit calculations
    const netProfit = bestPlatform.netProfit;
    const profitMargin = netProfit / buyPrice;
    // 4️⃣ Core verdict logic
    const verdictResult = (0, flipVerdict_1.getFlipVerdict)({
        buyPrice,
        avgResalePrice: bestPlatform.resalePrice,
        netProfit,
        historicalLow: priceAnalysis.historicalLow,
        currentPrice: priceAnalysis.currentPrice,
        demand,
        dealOrigin,
        priceTrendingDown: priceAnalysis.priceTrendingDown,
    });
    // 4.5️⃣ Deal Origin Scoring (CORRECT LOCATION)
    const originScore = (0, dealOriginScore_1.getDealOriginScore)(dealOrigin);
    let finalConfidence = verdictResult.confidence;
    // Boost confidence if justified
    if (originScore.confidenceBoost === "HIGH" &&
        finalConfidence !== "HIGH") {
        finalConfidence = "HIGH";
    }
    // Soften overconfidence for risky origins
    if (originScore.confidenceBoost === "LOW" &&
        finalConfidence === "HIGH") {
        finalConfidence = "MEDIUM";
    }
    // 5️⃣ Assemble FlipItem
    const flipItem = {
        id: generateId(),
        userId,
        source,
        createdAt: new Date(),
        updatedAt: new Date(),
        title,
        buyPrice,
        currentPrice: priceAnalysis.currentPrice,
        historicalLow: priceAnalysis.historicalLow,
        avgResalePrice: bestPlatform.resalePrice,
        netProfit,
        profitMargin,
        breakEvenPrice: buyPrice + bestPlatform.estimatedFees,
        demand,
        dealOrigin,
        verdict: verdictResult.verdict,
        confidence: finalConfidence,
        verdictReason: verdictResult.reason,
        bestPlatform: bestPlatform.platform,
        platformStats: platformRanking.all.reduce((acc, p) => {
            acc[p.platform.toLowerCase()] = p;
            return acc;
        }, {}),
        priceHistoryRange: "6M",
        priceTrendingDown: priceAnalysis.priceTrendingDown,
        saved: true,
        status: "ACTIVE",
    };
    return flipItem;
}
