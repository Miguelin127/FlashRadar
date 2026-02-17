// utils/flipAnalytics.ts
// Pure analytics helpers for Flip-It historic analysis

export type FlipItem = {
  netProfit: number;
  dealOrigin?: string;
  bestPlatform?: string;
  confidence?: number;
};

/* ─────────────────────────────
   BASIC METRICS
───────────────────────────── */

// ✅ Win rate (% of profitable flips)
export function getWinRate(flips: FlipItem[]): number {
  if (!flips.length) return 0;

  const wins = flips.filter((f) => f.netProfit > 0).length;
  return Math.round((wins / flips.length) * 100);
}

// ✅ Average net profit
export function getAverageProfit(flips: FlipItem[]): number {
  if (!flips.length) return 0;

  const total = flips.reduce((sum, f) => sum + (f.netProfit || 0), 0);
  return Math.round((total / flips.length) * 100) / 100;
}

// ✅ Total profit
export function getTotalProfit(flips: FlipItem[]): number {
  return flips.reduce((sum, f) => sum + (f.netProfit || 0), 0);
}

/* ─────────────────────────────
   GROUPED ANALYTICS
───────────────────────────── */

// 📦 Profit grouped by deal origin
export function profitByOrigin(flips: FlipItem[]) {
  const map: Record<string, { count: number; profit: number }> = {};

  flips.forEach((f) => {
    const key = f.dealOrigin || "UNKNOWN";
    if (!map[key]) map[key] = { count: 0, profit: 0 };

    map[key].count += 1;
    map[key].profit += f.netProfit || 0;
  });

  return Object.entries(map).map(([origin, v]) => ({
    origin,
    count: v.count,
    totalProfit: Math.round(v.profit * 100) / 100,
    avgProfit: Math.round((v.profit / v.count) * 100) / 100,
  }));
}

// 🛒 Profit grouped by platform
export function profitByPlatform(flips: FlipItem[]) {
  const map: Record<string, { count: number; profit: number }> = {};

  flips.forEach((f) => {
    const key = f.bestPlatform || "UNKNOWN";
    if (!map[key]) map[key] = { count: 0, profit: 0 };

    map[key].count += 1;
    map[key].profit += f.netProfit || 0;
  });

  return Object.entries(map).map(([platform, v]) => ({
    platform,
    count: v.count,
    totalProfit: Math.round(v.profit * 100) / 100,
    avgProfit: Math.round((v.profit / v.count) * 100) / 100,
  }));
}

/* ─────────────────────────────
   CONFIDENCE ANALYTICS
───────────────────────────── */

// 🎯 Confidence accuracy
// How often high-confidence flips actually won
export function confidenceAccuracy(flips: FlipItem[]) {
  const filtered = flips.filter(
    (f) => typeof f.confidence === "number"
  );

  if (!filtered.length) {
    return {
      highConfidenceWinRate: 0,
      mediumConfidenceWinRate: 0,
      lowConfidenceWinRate: 0,
    };
  }

  const bucket = (
    min: number,
    max: number
  ) =>
    filtered.filter(
      (f) =>
        typeof f.confidence === "number" &&
        f.confidence >= min &&
        f.confidence < max
    );

  const winRate = (group: FlipItem[]) =>
    group.length
      ? Math.round(
          (group.filter((f) => f.netProfit > 0).length /
            group.length) *
            100
        )
      : 0;

  return {
    highConfidenceWinRate: winRate(bucket(80, 101)),
    mediumConfidenceWinRate: winRate(bucket(55, 80)),
    lowConfidenceWinRate: winRate(bucket(0, 55)),
  };
}

/* ─────────────────────────────
   PATTERN DETECTION
───────────────────────────── */

// ⚠️ Detect repeat loss patterns
export function detectRiskPatterns(flips: FlipItem[]) {
  const patterns: string[] = [];

  const recent = flips.slice(0, 10);

  const losingOrigins = profitByOrigin(recent).filter(
    (o) => o.avgProfit < 0 && o.count >= 2
  );

  losingOrigins.forEach((o) => {
    patterns.push(
      `Repeated losses from ${o.origin} deals (avg ${o.avgProfit})`
    );
  });

  const losingPlatforms = profitByPlatform(recent).filter(
    (p) => p.avgProfit < 0 && p.count >= 2
  );

  losingPlatforms.forEach((p) => {
    patterns.push(
      `Platform ${p.platform} underperforming (avg ${p.avgProfit})`
    );
  });

  return patterns;
}

/* ─────────────────────────────
   MASTER ANALYZER
───────────────────────────── */

// 🧠 One-call analytics summary
export function analyzeFlips(flips: FlipItem[]) {
  return {
    totalFlips: flips.length,
    winRate: getWinRate(flips),
    totalProfit: getTotalProfit(flips),
    avgProfit: getAverageProfit(flips),
    byOrigin: profitByOrigin(flips),
    byPlatform: profitByPlatform(flips),
    confidence: confidenceAccuracy(flips),
    riskPatterns: detectRiskPatterns(flips),
  };
}
