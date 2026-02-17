import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { db } from "./firebaseAdmin";

const OUT_COL = "deals_online";

// 12 hours
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const expireAmazonDeals = onSchedule(
  {
    schedule: "every 30 minutes",
    region: "us-central1",
  },
  async () => {
    logger.info("🧹 AMAZON DEAL EXPIRY SCAN START");

    const cutoff = Date.now() - MAX_AGE_MS;

    const snap = await db
      .collection(OUT_COL)
      .where("store", "==", "Amazon")
      .where("updatedAt", "<", cutoff)
      .get();

    if (snap.empty) {
      logger.info("ℹ️ No expired deals");
      return;
    }

    const deletes = snap.docs.map((d) => d.ref.delete());

    await Promise.all(deletes);

    logger.info(`❌ Removed ${deletes.length} expired Amazon deals`);
  }
);
