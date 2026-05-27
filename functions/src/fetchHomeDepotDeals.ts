// functions/src/fetchHomeDepotDeals.ts
// App backend — Home Depot ingestion via Axesso RapidAPI
// Matches fetchTargetDeals.ts pattern exactly
// Budget: 50 req/month — rotates 1 query/run (~15 calls/month)

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { db } from "./firebaseAdmin";

if (!admin.apps.length) admin.initializeApp();

const RAPIDAPI_KEY = "b682e54321mshfd6a2415ca4a12ap143f48jsnf0b0fc5cf084";
const RAPIDAPI_HOST = "axesso-home-depot-api.p.rapidapi.com";
const MIN_DISCOUNT  = 20;

// 1 query per run, rotates by day — keeps usage ~15 req/month
const SEARCH_QUERIES = [
  "clearance tools",
  "clearance appliances",
  "clearance outdoor",
];

interface AxessoProduct {
  itemId?:        string;
  productTitle?:  string;
  productUrl?:    string;
  imageUrl?:      string;
  currentPrice?:  number;
  originalPrice?: number;
  lowPrice?:      number;
  highPrice?:     number;
  rating?:        number;
}

interface AxessoResponse {
  products?:          AxessoProduct[];
  searchProductList?: AxessoProduct[];
}

export const fetchHomeDepotDeals = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/Chicago",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    let written = 0;
    let skipped = 0;

    const queryIndex = new Date().getDate() % SEARCH_QUERIES.length;
    const query      = SEARCH_QUERIES[queryIndex];

    console.log(`[HomeDepot] Query: "${query}"`);

    try {
      const url = new URL(`https://${RAPIDAPI_HOST}/hod/v1/product/search`);
      url.searchParams.set("keyword", query);
      url.searchParams.set("page", "1");
      url.searchParams.set("sortBy", "best_seller");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "x-rapidapi-host": RAPIDAPI_HOST,
          "x-rapidapi-key":  RAPIDAPI_KEY,
          "Content-Type":    "application/json",
        },
      });

      if (!res.ok) {
        console.error(`[HomeDepot] API error: ${res.status}`);
        return;
      }

      const data: AxessoResponse = await res.json();
      const products = data.products ?? data.searchProductList ?? [];
      console.log(`[HomeDepot] ${products.length} results`);

      const batch = db.batch();
      let batchCount = 0;

      for (const p of products) {
        const price         = p.currentPrice  ?? p.lowPrice  ?? 0;
        const originalPrice = p.originalPrice ?? p.highPrice ?? 0;

        if (!price || price <= 0)                    { skipped++; continue; }
        if (!p.productTitle || !p.productUrl)        { skipped++; continue; }
        if (price < 10)                              { skipped++; continue; }
        if (!originalPrice || originalPrice <= price){ skipped++; continue; }

        const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
        if (discountPercent < MIN_DISCOUNT) { skipped++; continue; }

        const itemId = p.itemId ?? Buffer.from(p.productUrl).toString("base64").slice(0, 20);
        const id     = `HOMEDEPOT_${itemId}`;

        batch.set(
          db.collection("deals_online").doc(id),
          {
            id,
            title:            p.productTitle.trim(),
            price,
            originalPrice,
            listPrice:        originalPrice,
            discountPercent,
            store:            "Home Depot",
            storeKey:         "homedepot",
            source:           "axesso-homedepot",
            category:         query.replace("clearance ", ""),
            affiliateUrl:     p.productUrl,
            merchantUrl:      p.productUrl,
            url:              p.productUrl,
            imageUrl:         p.imageUrl ?? null,
            image:            p.imageUrl ?? null,
            live:             true,
            isActive:         true,
            hot:              discountPercent >= 30,
            rare:             discountPercent >= 50,
            enrichmentStatus: "enriched",
            createdAt:        admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        batchCount++;
        written++;

        if (batchCount >= 400) break;
      }

      if (batchCount > 0) await batch.commit();

    } catch (err: any) {
      console.error(`[HomeDepot] Error: ${err?.message}`);
    }

    console.log(`[HomeDepot] Done — written: ${written}, skipped: ${skipped}`);
  }
);