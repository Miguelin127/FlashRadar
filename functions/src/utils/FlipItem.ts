// functions/src/utils/FlipItem.ts

// Your codebase uses UPPERCASE platforms (ex: "AMAZON")
export type Platform =
  | "AMAZON"
  | "EBAY"
  | "FACEBOOK"
  | "MERCARI"
  | "OFFERUP";

// Your codebase uses WAIT (not HOLD)
export type FlipVerdict = "BUY" | "WAIT" | "SKIP";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type PlatformStats = {
  platform: Platform;
  resalePrice: number;
  estimatedFees: number;
  estimatedShipping?: number;
  netProfit: number;
  roi?: number;
};

export type FlipItem = {
  id: string;
  userId: string;

  source: "SCAN" | "LINK" | "MANUAL";
  status: "ACTIVE" | "SOLD" | "ARCHIVED";

  title: string;

  buyPrice: number;
  currentPrice: number;
  historicalLow: number;
  avgResalePrice: number;

  netProfit: number;
  profitMargin: number;
  breakEvenPrice: number;

  demand: "HIGH" | "MEDIUM" | "LOW";
  dealOrigin:
    | "PROMOTIONAL"
    | "OVERSTOCK"
    | "SLOW_SELLER"
    | "OBSOLETE"
    | "PRICING_ERROR";

  verdict: FlipVerdict;
  confidence: Confidence;
  verdictReason: string;

  bestPlatform: Platform;

  // keep keys flexible — your reducer builds these dynamically
  platformStats: Record<string, PlatformStats>;

  priceHistoryRange?: "1M" | "3M" | "6M" | "1Y";
  priceTrendingDown?: boolean;

  saved: boolean;

  createdAt: any;
  updatedAt: any;
};
