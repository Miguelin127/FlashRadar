import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "./firebaseAdmin";

const OUT_COL = "deals_online";

// CONFIG — tune freely
const MAX_AGE_HOURS = 12;        // expire old deals
const MIN_DISCOUNT = 20;         // %
const MAX_BATCH = 300;

/* ───────────────── CLEANUP JOB ───────────────── */

export const expireOnlineDeals = onSchedule(
  {
    schedule: "every 10 minutes",
    region: "us-central1",
  },
  async () => {
    logger.info("🧹 DEAL CLEANUP START");

    const now = Date.now();
    const cutoff = now - MAX_AGE_HOURS * 60 * 60 * 1000;

    const snap = await db
      .collection(OUT_COL)
      .orderBy("updatedAt", "asc")
      .limit(MAX_BATCH)
      .get();

    if (snap.empty) {
      logger.info("✅ No deals to clean");
      return;
    }

    const deletes: Promise<any>[] = [];

    for (const doc of snap.docs) {
      const d = doc.data();

      const updatedAt =
        d.updatedAt?.toMillis?.() ??
        new Date(d.updatedAt).getTime() ??
        0;

      const discount = Number(d.discountPercent ?? 0);

      const expired =
        updatedAt < cutoff || discount < MIN_DISCOUNT;

      if (expired) {
        deletes.push(doc.ref.delete());
      }
    }

    if (deletes.length) {
      await Promise.all(deletes);
    }

    logger.info(`🧹 CLEANUP DONE — removed ${deletes.length} deals`);
  }
);
