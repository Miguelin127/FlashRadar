// functions/src/walmartIngest.ts

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RAPID_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPID_HOST = "realtime-walmart-data.p.rapidapi.com";
const WALMART_PUBLISHER_ID = process.env.WALMART_PUBLISHER_ID ?? "";

function parsePrice(v?: string): number | null {
  if (!v || v === "Not available") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

function buildWalmartAffiliateUrl(rawUrl: string): string {
  if (!WALMART_PUBLISHER_ID || !rawUrl) return rawUrl;
  const full = rawUrl.startsWith("http")
    ? rawUrl
    : `https://www.walmart.com${rawUrl}`;
  return `https://goto.walmart.com/c/${WALMART_PUBLISHER_ID}/576484/9383?subId1=flashradar&u=${encodeURIComponent(full)}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const ingestWalmartDeals = onRequest(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (_req, res) => {
    if (!RAPID_KEY) {
      res.status(500).json({ error: "RAPIDAPI_KEY not set" });
      return;
    }

    try {
      const headers = {
        "x-rapidapi-key": RAPID_KEY,
        "x-rapidapi-host": RAPID_HOST,
      };

      const PAGES = 5; // 5 pages × ~10 results = ~50 rollback deals
      const allItems: any[] = [];

      for (let page = 1; page <= PAGES; page++) {
        const rollbackRes = await fetch(
          `https://${RAPID_HOST}/rollbacks?page=${page}`,
          { headers }
        );
        const rollbackJson: any = await rollbackRes.json();
        const results = rollbackJson.results ?? [];
        allItems.push(...results);
        console.log(`[Walmart] Page ${page}: ${results.length} items`);
        if (results.length === 0) break; // no more pages
        if (page < PAGES) await sleep(400); // stay under 3 req/sec
      }

      const batch = db.batch();
      let written = 0;
      const seen = new Set<string>();

      for (const item of allItems) {
        const key = item.usItemId ?? item.id;
        if (!key || seen.has(key)) continue;
        seen.add(key);

        const price = parsePrice(item.price);
        const originalPrice =
          parsePrice(item.originalPrice) ?? parsePrice(item.wasPrice);

        if (!price || price < 10) continue;

        const discountPercent =
          originalPrice && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : null;

        // Only keep deals with a real discount
        if (!discountPercent || discountPercent < 30) continue;

        const rawUrl = item.canonicalUrl ?? item.productPageUrl ?? "";
        const affiliateUrl = buildWalmartAffiliateUrl(rawUrl);
        const imageUrl = item.image ?? item.Image ?? null;

        const id = `WALMART_${key}`;
        const ref = db.collection("deals_live").doc(id);

        batch.set(
          ref,
          {
            id,
            title: item.name ?? item.title ?? "Walmart Deal",
            price,
            originalPrice: originalPrice ?? null,
            discountPercent,
            store: "Walmart",
            storeKey: "walmart",
            source: "walmart",
            affiliateUrl,
            merchantUrl: rawUrl.startsWith("http")
              ? rawUrl
              : `https://www.walmart.com${rawUrl}`,
            url: affiliateUrl,
            imageUrl,
            image: imageUrl,
            rating: item.rating ?? null,
            reviews: item.numberOfReviews ?? null,
            live: true,
            isActive: true,
            hot: (discountPercent ?? 0) >= 30,
            rare: (discountPercent ?? 0) >= 50,
            enrichmentStatus: "enriched",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        written++;
      }

      await batch.commit();
      console.log(`[Walmart] Written: ${written}`);
      res.json({ ok: true, written, total: allItems.length });
    } catch (err: any) {
      console.error("[Walmart] Error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);