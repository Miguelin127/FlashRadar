import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fetch from "node-fetch";

initializeApp();
const db = getFirestore();

// 🔐 SET THESE AS ENV VARS
const RAPID_KEY = process.env.RAPIDAPI_KEY!;
const RAPID_HOST = "realtime-walmart-data.p.rapidapi.com";

function parsePrice(v?: string) {
  if (!v || v === "Not available") return null;
  return Number(v.replace(/[^0-9.]/g, ""));
}

export const ingestWalmartDeals = onRequest(async (_req, res) => {
  try {
    // 1️⃣ PRODUCT SEARCH
    const productResp = await fetch(
      `https://${RAPID_HOST}/search?query=air%20fryer&page=1`,
      {
        headers: {
          "x-rapidapi-key": RAPID_KEY,
          "x-rapidapi-host": RAPID_HOST,
        },
      }
    );
    const productJson: any = await productResp.json();

    const map = new Map<string, any>();

    for (const p of productJson.results ?? []) {
      const key = p.usItemId ?? p.id;
      if (!key || !p.image) continue;

      map.set(key, {
        store: "Walmart",
        title: p.name,
        price: parsePrice(p.price),
        Image: p.image,          // ✅ PRIMARY (your app renders this)
        image: p.image,          // ✅ FALLBACK
        url: p.canonicalUrl,
        rating: p.rating ?? null,
        reviews: p.numberOfReviews ?? null,
        availability: p.availability ?? null,
        tags: ["LIVE"],
        source: "walmart_product_search",
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    // 2️⃣ ROLLBACKS
    const rollbackResp = await fetch(
      `https://${RAPID_HOST}/rollbacks?page=1`,
      {
        headers: {
          "x-rapidapi-key": RAPID_KEY,
          "x-rapidapi-host": RAPID_HOST,
        },
      }
    );
    const rollbackJson: any = await rollbackResp.json();

    for (const r of rollbackJson.results ?? []) {
      const key = r.usItemId ?? r.id;
      if (!map.has(key)) continue;

      const deal = map.get(key);
      const orig = parsePrice(r.originalPrice);
      const price = parsePrice(r.price);

      if (orig && price) {
        const pct = Math.round(((orig - price) / orig) * 100);

        deal.originalPrice = orig;
        deal.savings = parsePrice(r.savings);
        deal.discountPercent = pct;
        deal.tags.push("ROLLBACK");

        if (pct >= 50) deal.tags.push("RARE");
        else if (price <= 20) deal.tags.push("HOT");
      }
    }

    // 3️⃣ WRITE TO FIRESTORE
    const batch = db.batch();
    for (const [id, deal] of map) {
      const ref = db.collection("deals_live").doc(`walmart_${id}`);
      batch.set(ref, deal, { merge: true });
    }
    await batch.commit();

    res.json({ ok: true, written: map.size });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
