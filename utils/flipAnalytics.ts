import { FlipItem } from "./FlipItem";

export function analyzeFlips(
  flips: FlipItem[] = []
): {
  totalFlips: number;
  profitableFlips: number;
  totalProfit: number;
  avgProfit: number;
} {
  if (!Array.isArray(flips) || flips.length === 0) {
    return {
      totalFlips: 0,
      profitableFlips: 0,
      totalProfit: 0,
      avgProfit: 0,
    };
  }

  const profitable = flips.filter(f => f.netProfit > 0);
  const totalProfit = profitable.reduce(
    (sum, f) => sum + f.netProfit,
    0
  );

  return {
    totalFlips: flips.length,
    profitableFlips: profitable.length,
    totalProfit: Math.round(totalProfit),
    avgProfit: Math.round(
      totalProfit / (profitable.length || 1)
    ),
  };
}
