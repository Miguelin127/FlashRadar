// FlashRadarProject/utils/dealOriginScore.ts

import { DealOrigin, ConfidenceLevel } from "./flipVerdict";

export interface DealOriginScore {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  confidenceBoost: ConfidenceLevel | null;
  label: string;
}

export function getDealOriginScore(
  origin: DealOrigin
): DealOriginScore {
  switch (origin) {
    case "PRICING_ERROR":
      return {
        riskLevel: "LOW",
        confidenceBoost: "HIGH",
        label: "Pricing anomaly detected",
      };

    case "OVERSTOCK":
      return {
        riskLevel: "MEDIUM",
        confidenceBoost: null,
        label: "Overstock clearance",
      };

    case "PROMOTIONAL":
      return {
        riskLevel: "MEDIUM",
        confidenceBoost: null,
        label: "Promotional pricing",
      };

    case "SLOW_SELLER":
      return {
        riskLevel: "HIGH",
        confidenceBoost: "LOW",
        label: "Low demand product",
      };

    case "OBSOLETE":
      return {
        riskLevel: "HIGH",
        confidenceBoost: "LOW",
        label: "Outdated or replaced product",
      };

    default:
      return {
        riskLevel: "MEDIUM",
        confidenceBoost: null,
        label: "Unknown deal type",
      };
  }
}
