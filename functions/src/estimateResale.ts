import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

interface ResaleEstimate {
  low: number;
  mid: number;
  high: number;
  confidence: "high" | "medium" | "low";
  rationale: string;
  source: "ai_estimate";
}

export const estimateResale = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 30 },
  async (request) => {
    const d = request.data || {};
    const title = String(d.title || "").trim();
    if (!title) throw new HttpsError("invalid-argument", "title is required");
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Must be signed in");

    const condition = String(d.condition || "Used - Good");
    const buyPrice = Number(d.buyPrice) || 0;

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const prompt = `You estimate the SECONDHAND RESALE value of an item for a reseller. Respond with ONLY a JSON object, no other text.

Item: ${title}
Condition: ${condition}

Estimate what this realistically SELLS FOR used on marketplaces like eBay/Facebook (not the retail price). Return:
{
  "low": conservative resale price (number),
  "mid": most likely resale price (number),
  "high": optimistic resale price (number),
  "confidence": "high" ONLY for common, liquid, stably-priced items you know well; "medium" for reasonable guesses; "low" for niche, variable, or unfamiliar items,
  "rationale": one short sentence explaining the estimate and any risk (e.g. "Popular model, sells fast" or "Niche item, thin resale market")
}

CRITICAL: Be conservative and honest. If you are uncertain about this item's resale value, set confidence to "low" and widen the range. Never inflate. A reseller will risk real money on this — under-promise rather than over-promise.`;

    let est: ResaleEstimate;
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
        .trim()
        .replace(/```json|```/g, "")
        .trim();
      const parsed = JSON.parse(text);
      est = { ...parsed, source: "ai_estimate" };
    } catch (e) {
      console.error("[estimateResale] Claude error:", e);
      throw new HttpsError("internal", "Failed to estimate resale value");
    }

    return { estimate: est };
  }
);
