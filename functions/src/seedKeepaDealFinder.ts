import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import axios from "axios";
import { db } from "./firebaseAdmin";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

const ASIN_COL = "keepa_asin_pool";
const DOMAIN = 1; // Amazon US
const TIMEOUT = 30000;

export const seedKeepaDealFinder = onSchedule(
  {
    schedule: "every 15 minutes",
    secrets: [KEEPA_KEY],
    region: "us-central1",
  },
  async () => {
    logger.info("🌱 KEEPA DEAL FINDER SEED START");

    const key = KEEPA_KEY.value();
    if (!key) {
      logger.error("❌ Missing KEEPA_KEY");
      return;
    }

    let totalAdded = 0;

    for (let page = 0; page < 3; page++) {
      const res = await axios.get("https://api.keepa.com/deal", {
        params: {
          key,
          domain: DOMAIN,
          page,
          sortType: 4,     // biggest discount
          minDiscount: 20,
          minPrice: 1000,  // $10+
          maxAge: 12,      // last 12 hours
          priceTypes: "1,100",
        },
        timeout: TIMEOUT,
      });

      const deals = res.data?.deals;
      if (!Array.isArray(deals) || deals.length === 0) break;

      const writes: Promise<any>[] = [];

      for (const d of deals) {
        if (!d?.asin) continue;

        writes.push(
          db.collection(ASIN_COL).doc(d.asin).set(
            {
              asin: d.asin,
              source: "keepa_deal_finder",
              failCount: 0,
              lastScannedAt: new Date(0),
              createdAt: new Date(),
            },
            { merge: true }
          )
        );

        totalAdded++;
      }

      await Promise.all(writes);
    }

    logger.info(`✅ Seeded ${totalAdded} ASINs from Keepa`);
  }
);
