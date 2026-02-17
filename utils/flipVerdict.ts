// utils/flipVerdict.ts

export type FlipVerdict =
  | "BUY"
  | "WAIT"
  | "PASS";

export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

/**
 * Deal origin / classification
 * MUST include everything flipExplanation compares against
 */
export type DealOrigin =
  | "MANUAL"
  | "WEB_RADAR"
  | "FLIP_IT"
  | "PRICING_ERROR"
  | "SLOW_SELLER";

export function getFlipVerdict(
  profit: number,
  roi: number
): FlipVerdict {
  if (profit >= 100 || roi >= 50) return "BUY";
  if (profit > 0) return "WAIT";
  return "PASS";
}

export function getConfidenceLevel(
  roi: number
): ConfidenceLevel {
  if (roi >= 80) return "HIGH";
  if (roi >= 30) return "MEDIUM";
  return "LOW";
}
