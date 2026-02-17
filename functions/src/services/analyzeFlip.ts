// functions/src/services/analyzeFlip.ts

import { analyzePriceHistory, PricePoint } from "../utils/priceHistory";
import { rankPlatforms } from "../utils/platformProfit";
import { getFlipVerdict } from "../utils/flipVerdict";
import type { FlipItem, Platform as CanonicalPlatform } from "../utils/FlipItem";
import type { Platform as RawPlatform } from "../utils/platformProfit";
import { getDealOriginScore } from "../utils/dealOriginScore";

/**
 * Env-safe ID generator (Node / Firebase / RN compatible)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Normalize platform names so all FlipItems use canonical values
 */
function normalizePlatform(p: RawPlatform): CanonicalPlatform {
  switch (p) {
    case "FB":
      return "FACEBOOK";
    default:
      return p;
  }
}

interface AnalyzeFlipInput {
  userId: string;
  title: string;
  buyPrice: number;
  priceHistory: PricePoint[];
  platformInputs: Parameters<typeof rankPlatforms>[0];
  demand: "HIGH" | "MEDIUM" | "LOW";
  dealOrigin:
    | "PROMOTIONAL"
    | "OVERSTOCK"
    | "SLOW_SELLER"
    | "OBSOLETE"
    | "PRICING_ERROR";
  source: "SCAN" | "LINK" | "MANUAL";
}

export function analyzeFlip(input: AnalyzeFlipInput): FlipItem {
  const {
    userId,
    title,
    buyPrice,
    priceHistory,
    platformInputs,
    demand,
    dealOrigin,
    source,
  } = input;

  // 1️⃣ Price history analysis
  const priceAnalysis = analyzePriceHistory(priceHistory);

  // 2️⃣ Platform profit ranking
  const platformRanking = rankPlatforms(platformInputs);
  const bestPlatform = platformRanking.bestProfit;

  // 3️⃣ Profit math
  const netProfit = bestPlatform.netProfit;
  const profitMargin = buyPrice > 0 ? netProfit / buyPrice : 0;

  // 4️⃣ Core verdict logic
  const verdictResult = getFlipVerdict({
    buyPrice,
    avgResalePrice: bestPlatform.resalePrice,
    netProfit,
    historicalLow: priceAnalysis.historicalLow,
    currentPrice: priceAnalysis.currentPrice,
    demand,
    dealOrigin,
    priceTrendingDown: priceAnalysis.priceTrendingDown,
  });

  // 4.5️⃣ Deal origin scoring
  const originScore = getDealOriginScore(dealOrigin);

  let finalConfidence = verdictResult.confidence;

  if (
    originScore.confidenceBoost === "HIGH" &&
    finalConfidence !== "HIGH"
  ) {
    finalConfidence = "HIGH";
  }

  if (
    originScore.confidenceBoost === "LOW" &&
    finalConfidence === "HIGH"
  ) {
    finalConfidence = "MEDIUM";
  }

  // 5️⃣ Assemble FlipItem
  const flipItem: FlipItem = {
    id: generateId(),
    userId,
    source,

    createdAt: new Date() as any,
    updatedAt: new Date() as any,

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

    bestPlatform: normalizePlatform(bestPlatform.platform),

    platformStats: platformRanking.all.reduce(
      (acc: Record<string, any>, p) => {
        const key = normalizePlatform(p.platform);
        acc[key] = { ...p, platform: key };
        return acc;
      },
      {}
    ),

    priceHistoryRange: "6M",
    priceTrendingDown: priceAnalysis.priceTrendingDown,

    saved: true,
    status: "ACTIVE",
  };

  return flipItem;
}
