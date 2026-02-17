import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "./firebaseAdmin";

const ASIN_COL = "keepa_asin_pool";
const RESET_LIMIT = 200; // safety cap

export const reactivateDeadAsins = onSchedule(
  {
    schedule: "every sunday 03:00",
    region: "us-central1",
  },
  async () => {
    logger.info("♻️ Reactivating dead ASINs");

    const snap = await db
      .collection(ASIN_COL)
      .where("failCount", ">=", 10)
      .limit(RESET_LIMIT)
      .get();

    if (snap.empty) {
      logger.info("✅ No ASINs to reactivate");
      return;
    }

    const batch = db.batch();
    const now = new Date();

    snap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        failCount: 0,
        lastScannedAt: null,
        lastGoodDealAt: null,
        reactivatedAt: now,
      });
    });

    await batch.commit();

    logger.info(`♻️ Reactivated ${snap.size} ASINs`);
  }
);
