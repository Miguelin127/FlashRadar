// flashradar/utils/platformProfit.ts

export type Platform = "AMAZON" | "EBAY" | "FB" | "MERCARI";
export type DemandLevel = "HIGH" | "MEDIUM" | "LOW";

export interface PlatformInput {
  resalePrice: number;
  buyPrice: number;
  estimatedFees: number;
  shippingCost?: number;
  demand: DemandLevel;
}

export interface PlatformResult {
  platform: Platform;
  resalePrice: number;
  estimatedFees: number;
  shippingCost: number;
  netProfit: number;
  profitMargin: number;
  demand: DemandLevel;
  estimatedSellTimeDays: number;
}

export interface PlatformRankingResult {
  bestProfit: PlatformResult;
  fastestSale: PlatformResult;
  lowestRisk: PlatformResult;
  all: PlatformResult[];
}

/**
 * Estimate sell time based on demand (V1 heuristic)
 */
function estimateSellTime(demand: DemandLevel): number {
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
function calculatePlatformResult(
  platform: Platform,
  input: PlatformInput
): PlatformResult {
  const shipping = input.shippingCost ?? 0;

  const netProfit =
    input.resalePrice - input.buyPrice - input.estimatedFees - shipping;

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
export function rankPlatforms(input: {
  amazon?: PlatformInput;
  ebay?: PlatformInput;
  fb?: PlatformInput;
  mercari?: PlatformInput;
}): PlatformRankingResult {
  const results: PlatformResult[] = [];

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

  const bestProfit = [...results].sort(
    (a, b) => b.netProfit - a.netProfit
  )[0];

  const fastestSale = [...results].sort(
    (a, b) => a.estimatedSellTimeDays - b.estimatedSellTimeDays
  )[0];

  const lowestRisk = [...results].sort((a, b) => {
    const demandScore = (d: DemandLevel) =>
      d === "HIGH" ? 3 : d === "MEDIUM" ? 2 : 1;
    return demandScore(b.demand) - demandScore(a.demand);
  })[0];

  return {
    bestProfit,
    fastestSale,
    lowestRisk,
    all: results,
  };
}

