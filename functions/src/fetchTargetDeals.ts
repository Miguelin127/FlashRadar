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

// Target category IDs for clearance/deals
const CLEARANCE_CATEGORIES = [
  { id: "5xt1a", name: "Clearance" },
  { id: "55lzc", name: "Electronics Deals" },
  { id: "5xsxk", name: "Toys Clearance" },
  { id: "5xu1c", name: "Home Clearance" },
];

// Store IDs to query — high-volume stores
// These are real Target store IDs across major markets
const STORE_IDS = [
  "3991", // Chicago
  "1286", // Los Angeles
  "2564", // New York
  "1408", // Houston
  "2911", // Phoenix
];

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

    for (const store of STORE_IDS) {
      for (const category of CLEARANCE_CATEGORIES) {
        try {
          // Target RedSky API — public endpoint
          const url =
            `https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2` +
            `?key=ff457966e64d5e877fdbad070f276d18` +
            `&category=${category.id}` +
            `&channel=WEB` +
            `&count=24` +
            `&offset=0` +
            `&pricing_store_id=${store}` +
            `&scheduled_delivery_store_id=${store}` +
            `&store_ids=${store}` +
            `&useragent=Mozilla%2F5.0`;

          const res = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
              "Accept": "application/json",
            },
            timeout: 10000,
          });

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
                category: category.name,
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
          console.error(`[Target] Error store=${store} cat=${category.id}:`, err?.message);
        }
      }
    }

    console.log(`[Target] Done — written: ${written}, skipped: ${skipped}`);
  }
);