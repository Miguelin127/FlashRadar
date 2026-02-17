import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "./firebaseAdmin";

const OUT_COL = "deals_online";
const ASIN_COL = "keepa_asin_pool";

function extractAsin(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/);
  return match ? match[1] : null;
}

export const ingestAmazonAsins = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "us-central1",
  },
  async () => {
    logger.info("📥 ASIN INGEST START");

    const snap = await db
      .collection(OUT_COL)
      .where("store", "==", "Amazon")
      .limit(500)
      .get();

    if (snap.empty) {
      logger.info("ℹ️ No Amazon deals found");
      return;
    }

    const writes: Promise<any>[] = [];

    for (const doc of snap.docs) {
      const asin = extractAsin(doc.data().url);
      if (!asin) continue;

      const ref = db.collection(ASIN_COL).doc(`AUTO_${asin}`);

      writes.push(
        ref.set(
          {
            asin,
            lastScannedAt: null,
            source: "auto_ingest",
          },
          { merge: true }
        )
      );
    }

    if (writes.length) {
      await Promise.all(writes);
      logger.info(`✅ Ingested ${writes.length} ASINs`);
    }
  }
);
