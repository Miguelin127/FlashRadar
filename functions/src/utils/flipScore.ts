import { FlipItem } from "./FlipItem";

/**
 * Returns a Flip Score from 0–100
 * Higher = better flip opportunity
 */
export function calculateFlipScore(flip: FlipItem): number {
  let score = 0;

  /* ───────── Profit (max 40) ───────── */
  if (flip.netProfit >= 100) score += 40;
  else if (flip.netProfit >= 60) score += 30;
  else if (flip.netProfit >= 30) score += 20;
  else if (flip.netProfit >= 15) score += 10;
  else score += 5;

  /* ───────── Confidence (max 25) ───────── */
  const confidence =
    typeof flip.confidence === "number"
      ? flip.confidence
      : Number(flip.confidence) || 0;

  score += Math.min(25, Math.round(confidence * 0.25));

  /* ───────── Risk Penalty (max -20) ───────── */
  if (flip.dealOrigin === "OBSOLETE") score -= 20;
  else if (flip.dealOrigin === "SLOW_SELLER") score -= 14;
  else if (flip.dealOrigin === "OVERSTOCK") score -= 10;

  /* ───────── Trend (max 10) ───────── */
  if (flip.priceTrendingDown === false) score += 10;
  else if (flip.priceTrendingDown === true) score -= 5;

  /* ───────── Clamp 0–100 ───────── */
  return Math.max(0, Math.min(100, score));
}
