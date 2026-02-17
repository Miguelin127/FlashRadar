import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import axios from "axios";
import { db } from "./firebaseAdmin";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

const DOMAIN = 1; // Amazon US
const TIMEOUT = 30000;

/* ───────────────── HELPERS ───────────────── */

async function fetchDealAsins(key: string, page = 0): Promise<string[]> {
  const res = await axios.get("https://api.keepa.com/deal", {
    params: {
      key,
      domain: DOMAIN,
      page,
      selection: JSON.stringify({
        deltaPercentRange: [30, 95],
        isOutOfStock: false,
        hasReviews: true,
        minRating: 70,
      }),
    },
    timeout: TIMEOUT,
  });

  const rows = Array.isArray(res.data?.dr) ? res.data.dr : [];
  return rows.map((d: any) => d.asin).filter(Boolean);
}

/* ───────────────── SCHEDULED JOB ───────────────── */

export const discoverKeepaAsins = onSchedule(
  {
    schedule: "every 6 hours",
    secrets: [KEEPA_KEY],
    region: "us-central1",
  },
  async () => {
    logger.info("🧲 KEEPA ASIN DISCOVERY START");

    const key = KEEPA_KEY.value();
    if (!key) {
      logger.error("❌ Missing KEEPA_KEY");
      return;
    }

    const found = new Set<string>();

    // pull first 3 pages (~400–450 ASINs)
    for (let page = 0; page < 3; page++) {
      try {
        const asins = await fetchDealAsins(key, page);
        asins.forEach((a) => found.add(a));
      } catch (err: any) {
        logger.error(
          "❌ Keepa discovery failed",
          err?.response?.data || err?.message || err
        );
        break;
      }
    }

    if (!found.size) {
      logger.warn("⚠️ No ASINs discovered");
      return;
    }

    const writes: Promise<any>[] = [];

    for (const asin of found) {
      writes.push(
        db.collection("keepa_asins").doc(asin).set(
          {
            source: "keepa_deal_feed",
            discoveredAt: new Date(),
          },
          { merge: true }
        )
      );
    }

    await Promise.all(writes);

    logger.info(`✅ DISCOVERY DONE — added ${found.size} ASINs`);
  }
);
