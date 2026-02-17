import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";

/**
 * Permanently deletes expired deals older than 7 days
 * Runs once per day
 */
export const purgeExpiredDeals = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Chicago",
  },
  async () => {
    console.log("🗑️ Purge expired deals start");

    const now = Date.now();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - SEVEN_DAYS;

    const snap = await db
      .collection("deals_online")
      .where("expired", "==", true)
      .where("expiredAt", "<=", cutoff)
      .limit(500)
      .get();

    if (snap.empty) {
      console.log("✅ No expired deals to purge");
      return;
    }

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
    console.log(`🔥 Deleted ${snap.size} expired deals`);
  }
);
