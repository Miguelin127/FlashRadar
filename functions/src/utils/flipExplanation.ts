// FlashRadarProject/utils/flipExplanation.ts

import { FlipVerdict, ConfidenceLevel, DealOrigin } from "./flipVerdict";

export interface FlipExplanation {
  headline: string;
  detail: string;
  tone: "positive" | "caution" | "negative";
}

interface ExplanationInput {
  verdict: FlipVerdict;
  confidence: ConfidenceLevel;
  dealOrigin: DealOrigin;
  priceTrendingDown?: boolean;
}

export function getFlipExplanation(
  input: ExplanationInput
): FlipExplanation {
  const { verdict, dealOrigin, priceTrendingDown } = input;

  // 🔥 BUY
  if (verdict === "BUY") {
    return {
      headline: "Strong flip opportunity",
      detail:
        dealOrigin === "PRICING_ERROR"
          ? "Pricing anomaly detected — act fast"
          : "Margin and demand align at current price",
      tone: "positive",
    };
  }

  // ⏳ WAIT
  if (verdict === "WAIT") {
    if (priceTrendingDown) {
      return {
        headline: "Good flip — wait for better entry",
        detail: "Price is still trending down despite strong margins",
        tone: "caution",
      };
    }

    return {
      headline: "Decent flip with timing risk",
      detail: "Waiting could improve profit or reduce risk",
      tone: "caution",
    };
  }

  // ❌ SKIP
  return {
    headline: "Not a strong flip",
    detail:
      dealOrigin === "SLOW_SELLER"
        ? "Low demand detected — resale risk is high"
        : "Margins or demand do not justify this flip",
    tone: "negative",
  };
}
