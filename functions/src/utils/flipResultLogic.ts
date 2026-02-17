// flashradar/utils/flipResultLogic.ts

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type OriginRisk = "LOW" | "MEDIUM" | "HIGH";

export type FlipVerdict =
  | "FLIP"
  | "MAYBE"
  | "SKIP"
  | "CHECK LISTING"
  | "NEEDS MORE DATA";

type Input = {
  buyPrice?: number | string | null;
  avgResalePrice?: number | string | null;
  netProfit?: number | string | null;
  dealOrigin?: string | null; // e.g. "amazon", "walmart", "unknown", etc.
  priceTrendingDown?: boolean | null;
};

type Output = {
  confidencePercent: number; // 0-100
  confidenceLevel: ConfidenceLevel;
  originRisk?: OriginRisk;
  originLabel?: string;

  verdict: FlipVerdict;
  headline: string;
  detail: string;

  // Debugging / tuning
  score: number; // 0-100
  reasons: string[];
};

const toNum = (v: any): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

const confidenceFromScore = (score: number): ConfidenceLevel => {
  if (score >= 75) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
};

const originRiskFromOrigin = (origin?: string | null): { risk: OriginRisk; label: string } | null => {
  const o = (origin || "").toLowerCase().trim();
  if (!o) return null;

  // You can tune these anytime
  if (o.includes("amazon") || o.includes("walmart") || o.includes("target")) {
    return { risk: "LOW", label: "Trusted retailer" };
  }

  if (o.includes("facebook") || o.includes("offerup") || o.includes("craigslist")) {
    return { risk: "HIGH", label: "Marketplace risk" };
  }

  if (o.includes("unknown") || o.includes("unverified")) {
    return { risk: "MEDIUM", label: "Unverified source" };
  }

  return { risk: "MEDIUM", label: "Check seller/source" };
};

export function buildFlipResult(input: Input): Output {
  const buy = toNum(input.buyPrice);
  const resale = toNum(input.avgResalePrice);
  const net = toNum(input.netProfit);

  const reasons: string[] = [];
  let score = 50; // baseline

  // Data quality gates
  const hasBuy = buy > 0;
  const hasResale = resale > 0;

  if (!hasBuy || !hasResale) {
    score = 25;
    reasons.push("Missing buy/resale price");
    const origin = originRiskFromOrigin(input.dealOrigin);
    return {
      confidencePercent: clamp(score),
      confidenceLevel: confidenceFromScore(score),
      originRisk: origin?.risk,
      originLabel: origin?.label,
      verdict: "NEEDS MORE DATA",
      headline: "Not enough data to score this flip yet.",
      detail: "Add a buy price + a resale estimate so FlashRadar can calculate profit and risk.",
      score: clamp(score),
      reasons,
    };
  }

  // Profit ratio (net relative to buy)
  const profitRatio = buy > 0 ? net / buy : 0;

  // Absolute profit
  if (net >= 40) {
    score += 18; reasons.push("Strong profit ($40+)");
  } else if (net >= 20) {
    score += 10; reasons.push("Good profit ($20+)");
  } else if (net >= 10) {
    score += 4; reasons.push("Okay profit ($10+)");
  } else if (net <= 0) {
    score -= 22; reasons.push("No profit / loss");
  } else {
    score -= 6; reasons.push("Low profit");
  }

  // ROI (profit %)
  if (profitRatio >= 0.5) {
    score += 14; reasons.push("High ROI (50%+)");
  } else if (profitRatio >= 0.25) {
    score += 8; reasons.push("Solid ROI (25%+)");
  } else if (profitRatio < 0.1) {
    score -= 10; reasons.push("Low ROI (<10%)");
  }

  // Trending down is risky for holding inventory
  if (input.priceTrendingDown) {
    score -= 8; reasons.push("Price trending down");
  } else {
    score += 4; reasons.push("Price stable/up");
  }

  // Source risk
  const origin = originRiskFromOrigin(input.dealOrigin);
  if (origin?.risk === "HIGH") {
    score -= 12; reasons.push("High source risk");
  } else if (origin?.risk === "MEDIUM") {
    score -= 5; reasons.push("Medium source risk");
  } else if (origin?.risk === "LOW") {
    score += 3; reasons.push("Low source risk");
  }

  score = clamp(score);

  const confidenceLevel = confidenceFromScore(score);
  const confidencePercent = score;

  // Verdict thresholds
  let verdict: FlipVerdict = "MAYBE";
  if (score >= 75 && net > 0) verdict = "FLIP";
  else if (score >= 55 && net > 0) verdict = "MAYBE";
  else if (score < 45) verdict = "SKIP";

  // Narrative
  let headline = "Worth checking.";
  let detail = "This one has mixed signals—double-check comps before buying.";

  if (verdict === "FLIP") {
    headline = "This looks like a solid flip.";
    detail = "Strong profit + ROI with acceptable risk. Move fast if demand is real.";
  } else if (verdict === "SKIP") {
    headline = "Not worth the flip.";
    detail = "Low profit/ROI or risk is too high. Skip unless you find a much lower buy price.";
  }

  return {
    confidencePercent,
    confidenceLevel,
    originRisk: origin?.risk,
    originLabel: origin?.label,
    verdict,
    headline,
    detail,
    score,
    reasons,
  };
}
