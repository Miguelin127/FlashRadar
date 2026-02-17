import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "./firebaseAdmin";

const ASIN_COL = "keepa_asin_pool";

export const purgeDeadAsins = onSchedule(
  {
    schedule: "every day 03:00",
    region: "us-central1",
  },
  async () => {
    logger.info("🧹 PURGING DEAD ASINS");

    const snap = await db
      .collection(ASIN_COL)
      .where("failCount", ">=", 15)
      .get();

    if (snap.empty) {
      logger.info("ℹ️ No dead ASINs");
      return;
    }

    await Promise.all(snap.docs.map((d) => d.ref.delete()));

    logger.info(`❌ Removed ${snap.size} dead ASINs`);
  }
);
