import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";

/**
 * Cleanup job:
 * Marks expired Lightning deals as expired=true
 * Runs every 30 minutes
 */
export const expireLightningDeals = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Chicago",
  },
  async () => {
    console.log("🧹 Lightning cleanup start");

    const now = Date.now();

    const snap = await db
      .collection("deals_online")
      .where("lightning", "==", true)
      .where("expired", "!=", true)
      .get();

    if (snap.empty) {
      console.log("⚡ No lightning deals found");
      return;
    }

    const batch = db.batch();
    let expiredCount = 0;

    snap.docs.forEach((doc) => {
      const data = doc.data();
      const expiresAt =
        typeof data.expiresAt === "number"
          ? data.expiresAt
          : typeof data.timestamp === "number"
          ? data.timestamp + 6 * 60 * 60 * 1000 // fallback 6h
          : null;

      if (expiresAt && expiresAt <= now) {
        batch.update(doc.ref, {
          expired: true,
          expiredAt: now,
        });
        expiredCount++;
      }
    });

    if (expiredCount === 0) {
      console.log("✅ No expired lightning deals");
      return;
    }

    await batch.commit();
    console.log(`🗑️ Marked ${expiredCount} lightning deals as expired`);
  }
);
