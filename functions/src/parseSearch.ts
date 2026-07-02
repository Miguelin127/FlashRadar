import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const FREE_DAILY_LIMIT = 5;

interface ParsedSearch {
  keywords: string;
  priceMin: number | null;
  priceMax: number | null;
  sortBy: string | null;
  storeHint: string | null;
}

export const parseSearch = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 30 },
  async (request) => {
    const query = (request.data?.query as string | undefined)?.trim();
    const isPremium = !!request.data?.isPremium;
    const uid = request.auth?.uid;
    if (!query) throw new HttpsError("invalid-argument", "query is required");
    if (!uid) throw new HttpsError("unauthenticated", "Must be signed in");

    const db = getFirestore();

    // Daily limit for free users
    if (!isPremium) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const usageRef = db.collection("aiSearchUsage").doc(uid);
      const usageSnap = await usageRef.get();
      const usage = usageSnap.data();
      const count = usage && usage.date === today ? (usage.count || 0) : 0;

      if (count >= FREE_DAILY_LIMIT) {
        return { limitReached: true, remaining: 0 };
      }
      // increment (reset if new day)
      if (usage && usage.date === today) {
        await usageRef.update({ count: FieldValue.increment(1) });
      } else {
        await usageRef.set({ date: today, count: 1 });
      }
    }

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const prompt = `You convert a shopper's natural-language request into structured search filters for a deals app. Respond with ONLY a JSON object, no other text.

Shopper query: "${query}"

Return exactly this shape:
{
  "keywords": "the core product terms to search, e.g. 'electric bike' or 'gaming monitor'",
  "priceMin": number or null,
  "priceMax": number or null,
  "sortBy": one of "discount" | "price-low" | "price-high" | "newest" | null,
  "storeHint": a single store name if the shopper named one (e.g. "amazon", "walmart", "nike"), else null
}

Extract price limits from phrases like "under $700" (priceMax: 700) or "between $50 and $100". Pick sortBy only if implied (e.g. "cheapest" -> "price-low", "biggest discount" -> "discount"). Keep keywords concise — just the product, no filler words.`;

    let parsed: ParsedSearch;
    try {
      const msg = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });
      const text = msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .trim()
        .replace(/```json|```/g, "")
        .trim();
      parsed = JSON.parse(text) as ParsedSearch;
    } catch (e) {
      console.error("[parseSearch] Claude error:", e);
      throw new HttpsError("internal", "Failed to parse search");
    }

    return { parsed, limitReached: false };
  }
);
