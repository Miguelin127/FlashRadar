// functions/src/fetchTargetDeals.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import * as admin from "firebase-admin";
import { db } from "./firebaseAdmin";

if (!admin.apps.length) admin.initializeApp();

const AFFILIATE_TAG = "flashradar20-20";

// Target Impact Radius publisher ID
const TARGET_PUBLISHER_ID = process.env.TARGET_PUBLISHER_ID ?? "";

function buildTargetAffiliateUrl(tcin: string): string {
  const productUrl = `https://www.target.com/p/-/A-${tcin}`;
  if (!TARGET_PUBLISHER_ID) return productUrl;
  return `https://goto.target.com/c/${TARGET_PUBLISHER_ID}/81938/2092?subId1=flashradar&u=${encodeURIComponent(productUrl)}`;
}

// Deal-dense search terms. Target rotates category IDs; keywords are stable.
const KEYWORDS = [
  "tv", "laptop", "headphones", "tablet", "monitor",
  "air fryer", "coffee maker", "vacuum", "toys", "kitchen",
];

const REDSKY_KEY = "ff457966e64d5e877fdbad070f276d18";
const VISITOR_ID = "0192F3A74C8B4D2E9F1A6B5C3D7E8F90";

// Metro ZIPs. Real store numbers are resolved at runtime, so a retired
// store never silently zeroes out a whole market.
const ZIPS = ["60073", "90001", "10001", "77001", "85001"];

async function resolveStoreIds(): Promise<string[]> {
  const ids: string[] = [];
  for (const zip of ZIPS) {
    try {
      const url =
        "https://redsky.target.com/redsky_aggregations/v1/web/nearby_stores_v1" +
        "?key=" + REDSKY_KEY +
        "&limit=2&within=50&place=" + zip +
        "&visitor_id=" + VISITOR_ID +
        "&channel=WEB&page=%2Fsl%2F" + zip;
      const res = await axios.get(url, { timeout: 10000 });
      if (res.data?.errors) {
        console.error("[Target] store lookup errors:", JSON.stringify(res.data.errors).slice(0, 200));
      }
      const stores = res.data?.data?.nearby_stores?.stores ?? [];
      for (const st of stores) {
        if (st?.store_id) ids.push(String(st.store_id));
      }
    } catch (err: any) {
      console.error("[Target] store lookup failed for " + zip + ":", err?.message);
    }
  }
  return Array.from(new Set(ids));
}


export const fetchTargetDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    let written = 0;
    let skipped = 0;

    const storeIds = await resolveStoreIds();
    console.log("[Target] resolved " + storeIds.length + " real store ids");

    for (const store of storeIds) {
      for (const keyword of KEYWORDS) {
        try {
          // Target RedSky API — public endpoint
          const url =
            "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2" +
            "?key=" + REDSKY_KEY +
            "&keyword=" + encodeURIComponent(keyword) +
            "&channel=WEB&count=24&offset=0" +
            "&page=%2Fs%2F" + encodeURIComponent(keyword) +
            "&visitor_id=" + VISITOR_ID +
            "&pricing_store_id=" + store +
            "&store_ids=" + store +
            "&default_purchasability_filter=true&new_search=true" +
            "&platform=desktop&spellcheck=true&include_sponsored=true" +
            "&useragent=Mozilla%2F5.0";

          const res = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
              "Accept": "application/json",
            },
            timeout: 10000,
          });

          if (res.data?.errors) {
            console.error("[Target] redsky errors:", JSON.stringify(res.data.errors).slice(0, 200));
          }
          const products = res.data?.data?.search?.products ?? [];

          const batch = db.batch();
          let batchCount = 0;

          for (const p of products) {
            const price = p.price?.current_retail;
            const originalPrice = p.price?.reg_retail;

            if (!price || !originalPrice || price >= originalPrice) {
              skipped++;
              continue;
            }

            // Minimum $10, minimum 10% off
            if (price < 10) { skipped++; continue; }

            const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
            if (discountPercent < 10) { skipped++; continue; }

            const tcin = p.tcin;
            if (!tcin) { skipped++; continue; }

            const id = `TARGET_${store}_${tcin}`;
            const affiliateUrl = buildTargetAffiliateUrl(tcin);
            const imageUrl = p.item?.enrichment?.images?.primary_image_url ?? null;

            batch.set(
              db.collection("deals_online").doc(id),
              {
                id,
                title: p.item?.product_description?.title ?? "Target Deal",
                price,
                originalPrice,
                listPrice: originalPrice,
                discountPercent,
                store: "Target",
                storeKey: "target",
                source: "target",
                category: keyword,
                storeId: store,
                affiliateUrl,
                merchantUrl: `https://www.target.com/p/-/A-${tcin}`,
                url: affiliateUrl,
                imageUrl,
                image: imageUrl,
                tcin,
                live: true,
                isActive: true,
                hot: discountPercent >= 30,
                rare: discountPercent >= 50,
                enrichmentStatus: "enriched",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            batchCount++;
            written++;
          }

          if (batchCount > 0) await batch.commit();

          // Rate limit — be respectful of Target's API
          await new Promise((r) => setTimeout(r, 500));

        } catch (err: any) {
          console.error("[Target] Error store=" + store + " kw=" + keyword + ":", err?.message);
        }
      }
    }

    console.log(`[Target] Done — written: ${written}, skipped: ${skipped}`);
  }
);