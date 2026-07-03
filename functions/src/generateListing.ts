import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

interface ListingDraft {
  title: string;
  description: string;
  suggestedPrice: number;
  tips: string[];
}

export const generateListing = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 30 },
  async (request) => {
    const d = request.data || {};
    const title = String(d.title || "").trim();
    if (!title) throw new HttpsError("invalid-argument", "title is required");
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Must be signed in");

    const buyPrice = Number(d.buyPrice) || 0;
    const avgResalePrice = Number(d.avgResalePrice) || 0;
    const condition = String(d.condition || "New");
    const platform = String(d.platform || "Facebook Marketplace");

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const prompt = `You are helping a reseller write a listing to sell an item on ${platform}. Write a compelling, honest listing. Respond with ONLY a JSON object, no other text.

Item: ${title}
Condition: ${condition}
${avgResalePrice > 0 ? `Typical resale value: $${avgResalePrice}` : ""}
${buyPrice > 0 ? `(Seller's cost, do NOT mention in listing: $${buyPrice})` : ""}

Return exactly this JSON:
{
  "title": "a punchy marketplace title, under 80 chars, keyword-rich for search",
  "description": "3-5 short sentences: what it is, condition, why it's a great buy, and a light call to action. Friendly, trustworthy tone. No emojis overload — at most 1-2.",
  "suggestedPrice": a number — a smart asking price for ${platform} (slightly above your target to leave room to negotiate; base it on the resale value if provided),
  "tips": ["2-3 short selling tips specific to this item and platform, e.g. best photo angle, when to post, how to handle lowballers"]
}

Keep it honest — never fabricate specs or overstate condition.`;

    let draft: ListingDraft;
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim()
        .replace(/```json|```/g, "")
        .trim();
      draft = JSON.parse(text) as ListingDraft;
    } catch (e) {
      console.error("[generateListing] Claude error:", e);
      throw new HttpsError("internal", "Failed to generate listing");
    }

    return { draft };
  }
);
