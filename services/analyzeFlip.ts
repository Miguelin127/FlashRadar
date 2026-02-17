// flashradar/services/analyzeFlip.ts

import {
  FlipVerdict,
  ConfidenceLevel,
  getFlipVerdict,
  getConfidenceLevel,
} from "../utils/flipVerdict";

export type AnalyzeFlipInput = {
  userId: string;
  title: string;
  buyPrice: number;
  priceHistory: { date: number; price: number }[];
  platformInputs: Record<string, any>;
  demand: "LOW" | "MEDIUM" | "HIGH";
  dealOrigin:
    | "MANUAL"
    | "WEB_RADAR"
    | "FLIP_IT"
    | "PRICING_ERROR"
    | "SLOW_SELLER";
  source: "LINK" | "SCAN" | "MANUAL";
};

export function analyzeFlip(input: AnalyzeFlipInput) {
  const {
    title,
    buyPrice,
    priceHistory,
    platformInputs,
    dealOrigin,
    source,
  } = input;

  // Fallback resale estimate if no history
  const avgResalePrice =
    priceHistory.length > 0
      ? Math.round(
          priceHistory.reduce((sum, p) => sum + p.price, 0) /
            priceHistory.length
        )
      : Math.round(buyPrice * 1.4);

  const estimatedFees = Math.round(avgResalePrice * 0.15);
  const netProfit = avgResalePrice - buyPrice - estimatedFees;
  const roi = Math.round((netProfit / buyPrice) * 100);

  // ✅ Correct, type-safe verdict & confidence
  const verdict: FlipVerdict = getFlipVerdict(netProfit, roi);
  const confidence: ConfidenceLevel = getConfidenceLevel(roi);

  return {
    title,
    buyPrice,
    avgResalePrice,
    estimatedFees,
    netProfit,
    roi,
    verdict,
    confidence,
    dealOrigin,
    source,
    priceTrendingDown: false,
    breakEvenPrice: buyPrice + estimatedFees,
    bestPlatform: "Amazon",
    platformInputs,
  };
}
