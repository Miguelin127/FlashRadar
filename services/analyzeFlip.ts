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

  // Use the resale price passed in platformInputs (from estimateResale).
  // Rank all provided platforms by net profit and pick the best.
  const platformKeys = Object.keys(platformInputs || {});
  let best = { platform: "eBay", resalePrice: Math.round(buyPrice * 1.4), estimatedFees: 0, netProfit: -Infinity };

  const prettyName = (k: string) => {
    const map: Record<string, string> = {
      ebay: "eBay", facebook: "Facebook Marketplace", fb: "Facebook Marketplace",
      mercari: "Mercari", offerup: "OfferUp", amazon: "Amazon",
    };
    return map[k.toLowerCase()] || k;
  };

  for (const key of platformKeys) {
    const pi = platformInputs[key] || {};
    const resale = Number(pi.resalePrice) || 0;
    if (resale <= 0) continue;
    const fees = Number(pi.estimatedFees) || Math.round(resale * 0.13);
    const shipping = Number(pi.estimatedShipping) || 0;
    const net = resale - buyPrice - fees - shipping;
    if (net > best.netProfit) {
      best = { platform: prettyName(key), resalePrice: resale, estimatedFees: fees, netProfit: net };
    }
  }

  // Fallback if nothing valid was passed
  if (best.netProfit === -Infinity) {
    const resale = Math.round(buyPrice * 1.4);
    const fees = Math.round(resale * 0.13);
    best = { platform: "eBay", resalePrice: resale, estimatedFees: fees, netProfit: resale - buyPrice - fees };
  }

  const avgResalePrice = best.resalePrice;
  const estimatedFees = best.estimatedFees;
  const netProfit = best.netProfit;
  const roi = buyPrice > 0 ? Math.round((netProfit / buyPrice) * 100) : 0;

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
    bestPlatform: best.platform,
    platformInputs,
  };
}
