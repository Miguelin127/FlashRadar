import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

interface DealExplanation {
  verdict: "Strong Buy" | "Good Deal" | "Fair" | "Skip";
  savingsNote: string;
  reasoning: string;
  flipPotential: "High" | "Medium" | "Low" | null;
}

export const explainDeal = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 30 },
  async (request) => {
    const dealId = request.data?.dealId as string | undefined;
    if (!dealId) throw new HttpsError("invalid-argument", "dealId is required");

    const db = getFirestore();
    const ref = db.collection("deals_live").doc(dealId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Deal not found");

    const deal = snap.data() || {};

    // Cache hit — return instantly, no Claude call, no cost.
    if (deal.aiExplanation) {
      return { explanation: deal.aiExplanation as DealExplanation, cached: true };
    }

    const price = Number(deal.price) || 0;
    const originalPrice = Number(deal.originalPrice) || 0;
    const discount = Number(deal.discountPercent) || 0;
    const title = String(deal.title || "Unknown product");
    const store = String(deal.store || "a retailer");
    const hasCoupon = !!deal.couponCode;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const prompt = `You are a savvy deal analyst for a reseller-arbitrage app. Assess this deal and respond with ONLY a JSON object, no other text.

Deal:
- Product: ${title}
- Store: ${store}
- Current price: $${price}
- Original/list price: $${originalPrice || "unknown"}
- Discount: ${discount}%
- Coupon required: ${hasCoupon ? "yes" : "no"}

Respond with exactly this JSON shape:
{
  "verdict": one of "Strong Buy" | "Good Deal" | "Fair" | "Skip",
  "savingsNote": a short phrase like "50% off — $195 below list",
  "reasoning": one or two sentences on why this is or isn't a good deal for a buyer or reseller,
  "flipPotential": one of "High" | "Medium" | "Low" | null (null if not a resellable item)
}

Base the verdict mainly on discount depth and how in-demand/resellable the item is. Be honest — not every deal is a Strong Buy.`;

    let explanation: DealExplanation;
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim();

      const clean = text.replace(/```json|```/g, "").trim();
      explanation = JSON.parse(clean) as DealExplanation;
    } catch (e) {
      console.error("[explainDeal] Claude error:", e);
      throw new HttpsError("internal", "Failed to generate explanation");
    }

    // Cache to the deal doc so future views are free.
    await ref.update({ aiExplanation: explanation, aiExplanationAt: new Date() });

    return { explanation, cached: false };
  }
);
