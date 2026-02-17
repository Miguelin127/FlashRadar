import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import axios from "axios";
import { db } from "./firebaseAdmin";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

const ASIN_COL = "keepa_asin_pool";
const DOMAIN = 1;
const TIMEOUT = 30000;

// Example categories (Electronics, Tools, Home)
const CATEGORIES = [
  172282, // Electronics
  228013, // Tools & Home Improvement
  1063498 // Home & Kitchen
];

export const seedKeepaCategory = onSchedule(
  {
    schedule: "every 6 hours",
    secrets: [KEEPA_KEY],
    region: "us-central1",
  },
  async () => {
    logger.info("🌱 KEEPA CATEGORY SEED START");

    const key = KEEPA_KEY.value();
    if (!key) return;

    const writes: Promise<any>[] = [];

    for (const cat of CATEGORIES) {
      const res = await axios.get("https://api.keepa.com/bestsellers", {
        params: {
          key,
          domain: DOMAIN,
          category: cat,
        },
        timeout: TIMEOUT,
      });

      const asins: string[] = res.data?.bestSellersList?.asinList ?? [];

      for (const asin of asins) {
        writes.push(
          db.collection(ASIN_COL).doc(`CAT_${asin}`).set(
            {
              asin,
              lastScannedAt: null,
              source: "keepa_category",
              category: cat,
            },
            { merge: true }
          )
        );
      }
    }

    await Promise.all(writes);
    logger.info(`✅ Category seeding complete`);
  }
);
