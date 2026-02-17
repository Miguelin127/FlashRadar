// flashradar/utils/flipVerdict.ts

export type DemandLevel = "HIGH" | "MEDIUM" | "LOW";
export type DealOrigin =
  | "PROMOTIONAL"
  | "OVERSTOCK"
  | "SLOW_SELLER"
  | "OBSOLETE"
  | "PRICING_ERROR";

export type FlipVerdict = "BUY" | "WAIT" | "SKIP";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

interface FlipVerdictInput {
  buyPrice: number;
  avgResalePrice: number;
  netProfit: number;
  historicalLow: number;
  currentPrice: number;
  demand: DemandLevel;
  dealOrigin: DealOrigin;
  priceTrendingDown?: boolean;
}

interface FlipVerdictResult {
  verdict: FlipVerdict;
  confidence: ConfidenceLevel;
  reason: string;
}

export function getFlipVerdict(input: FlipVerdictInput): FlipVerdictResult {
  const {
    buyPrice,
    netProfit,
    historicalLow,
    currentPrice,
    demand,
    dealOrigin,
    priceTrendingDown = false,
  } = input;

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
  if (
    netProfit < 10 ||
    profitMargin < 0.15 ||
    demand === "LOW" ||
    dealOrigin === "SLOW_SELLER" ||
    dealOrigin === "OBSOLETE"
  ) {
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

  if (
    (netProfit >= 20 || profitMargin >= 0.25) &&
    nearHistoricalLow &&
    (demand === "HIGH" || demand === "MEDIUM")
  ) {
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
