// flashradar/utils/priceHistory.ts

export type PricePoint = {
  date: number; // unix timestamp (ms)
  price: number;
};

export type PriceTrend = "UP" | "FLAT" | "DOWN";

export interface PriceHistoryResult {
  currentPrice: number;
  historicalLow: number;
  historicalHigh: number;
  averagePrice: number;
  trend: PriceTrend;
  priceTrendingDown: boolean;
}

/**
 * Analyze price history data (Keepa-style but generic)
 * Expects array sorted OR unsorted — function will normalize
 */
export function analyzePriceHistory(
  priceHistory: PricePoint[]
): PriceHistoryResult {
  if (!priceHistory || priceHistory.length === 0) {
    throw new Error("Price history data is required");
  }

  // Sort oldest → newest
  const sorted = [...priceHistory].sort((a, b) => a.date - b.date);

  const prices = sorted.map(p => p.price);

  const currentPrice = prices[prices.length - 1];
  const historicalLow = Math.min(...prices);
  const historicalHigh = Math.max(...prices);
  const averagePrice =
    prices.reduce((sum, p) => sum + p, 0) / prices.length;

  // Trend logic (last 30% vs first 30%)
  const sliceSize = Math.max(1, Math.floor(prices.length * 0.3));

  const earlySlice = prices.slice(0, sliceSize);
  const lateSlice = prices.slice(prices.length - sliceSize);

  const earlyAvg =
    earlySlice.reduce((sum, p) => sum + p, 0) / earlySlice.length;

  const lateAvg =
    lateSlice.reduce((sum, p) => sum + p, 0) / lateSlice.length;

  let trend: PriceTrend = "FLAT";

  if (lateAvg > earlyAvg * 1.05) {
    trend = "UP";
  } else if (lateAvg < earlyAvg * 0.95) {
    trend = "DOWN";
  }

  return {
    currentPrice,
    historicalLow,
    historicalHigh,
    averagePrice,
    trend,
    priceTrendingDown: trend === "DOWN",
  };
}
