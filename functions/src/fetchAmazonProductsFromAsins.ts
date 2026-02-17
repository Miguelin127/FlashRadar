import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Secrets
 */
const KEEPA_KEY = defineSecret("KEEPA_KEY");

/**
 * Tunables
 */
const DOMAIN_ID = 1; // Amazon US
const BATCH_SIZE = 20; // ASINs per run (safe)
const MIN_DISCOUNT_PERCENT = 20;

/**
 * Keepa helpers
 */
function keepaPriceToDollars(price?: number | null) {
  // Keepa prices are in cents * -1 when unavailable
  if (typeof price !== "number" || price <= 0) return null;
  return Number((price / 100).toFixed(2));
}

export const fetchAmazonProductsFromAsins = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Chicago",
    secrets: [KEEPA_KEY],
  },
  async () => {
    console.log("🟦 AMAZON ASIN FETCH START");

    const key = KEEPA_KEY.value();
    if (!key) {
      console.error("❌ Missing KEEPA_KEY");
      return;
    }

    /**
     * 1️⃣ Pull unprocessed ASINs
     */
    const asinSnap = await db
      .collection("keepa_asin_pool")
      .limit(BATCH_SIZE)
      .get();

    if (asinSnap.empty) {
      console.log("ℹ️ No ASINs to process");
      return;
    }

    const asins = asinSnap.docs
      .map((d) => d.data().asin)
      .filter(Boolean);
    console.log(`📦 Processing ${asins.length} ASINs`);

    /**
     * 2️⃣ Fetch product data from Keepa
     */
    const res = await axios.get("https://api.keepa.com/product", {
      params: {
        key,
        domain: DOMAIN_ID,
        asin: asins.join(","),
        stats: 1,
        offers: 20,
      },
      timeout: 20000,
    });

    const products = res.data?.products || [];
    if (!products.length) {
      console.warn("⚠️ Keepa returned 0 products");
      return;
    }

    const batch = db.batch();

    /**
     * 3️⃣ Parse + write deals
     */
    for (const p of products) {
      const asin: string = p.asin;
      const title: string = p.title || "Amazon Product";

      const stats = p.stats || {};
      const current = keepaPriceToDollars(stats.current?.[0]);
      const avg90 = keepaPriceToDollars(stats.avg90?.[0]);
      const listPrice = keepaPriceToDollars(p.csv?.[0]?.[0]);

      if (!current || !avg90) continue;

      const discountPercent = Math.round(((avg90 - current) / avg90) * 100);
      if (discountPercent < MIN_DISCOUNT_PERCENT) continue;

      const image =
        p.imagesCSV?.split(",")?.[0]
          ? `https://images-na.ssl-images-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
          : null;

      const dealId = `AMZ_${asin}`;

      /**
       * 4️⃣ Write to deals_online
       */
      batch.set(
        db.collection("deals_online").doc(dealId),
        {
          id: dealId,
          asin,
          title,
          price: current,
          listPrice: avg90,
          discountPercent,
          store: "Amazon",
          source: "amazon_keepa",
          online: true,
          image,
          url: `https://www.amazon.com/dp/${asin}?tag=flashradar20e-20`,
          hot: current <= 10,
          rare: discountPercent >= 70,
          timestamp: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      /**
       * 5️⃣ Mark ASIN processed
       */
      batch.set(
        db.collection("keepa_asin_pool").doc(asin),
        {
          processed: true,
          lastProcessedAt: Date.now(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    console.log("✅ Amazon deals saved + ASINs marked processed");
  }
);
