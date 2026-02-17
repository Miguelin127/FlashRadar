"use strict";
// FlashRadarProject/utils/flipAlertEvaluator.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFlipAlert = evaluateFlipAlert;
const analyzeFlip_1 = require("../services/analyzeFlip");
function evaluateFlipAlert(input) {
    const { existingFlip, updatedPriceHistory, platformInputs } = input;
    // Only monitor WAIT flips
    if (existingFlip.verdict !== "WAIT") {
        return {
            shouldNotify: false,
            newFlip: existingFlip,
        };
    }
    const reAnalyzedFlip = (0, analyzeFlip_1.analyzeFlip)({
        userId: existingFlip.userId,
        title: existingFlip.title,
        buyPrice: existingFlip.buyPrice,
        priceHistory: updatedPriceHistory,
        platformInputs,
        demand: existingFlip.demand,
        dealOrigin: existingFlip.dealOrigin,
        source: existingFlip.source,
    });
    // WAIT → BUY transition
    if (reAnalyzedFlip.verdict === "BUY") {
        return {
            shouldNotify: true,
            newFlip: reAnalyzedFlip,
            reason: "Price hit optimal buy zone",
        };
    }
    return {
        shouldNotify: false,
        newFlip: reAnalyzedFlip,
    };
}
