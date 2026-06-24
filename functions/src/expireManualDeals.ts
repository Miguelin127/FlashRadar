import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";

// Manually-published deals (Pipeline/Admin) live ~5 days, then are deleted.
// Only deals from these sources are affected — auto-ingested deals are untouched.
const MANUAL_SOURCES = ["manual-entry", "ironclad_v11", "pipeline", "vip"];

export const expireManualDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeoutSeconds: 120,
  },
  async () => {
    const now = Date.now();
    let totalDeleted = 0;

    for (const source of MANUAL_SOURCES) {
      const snap = await db
        .collection("deals_live")
        .where("source", "==", source)
        .where("expiresAt", "<=", now)
        .limit(500)
        .get();

      if (snap.empty) continue;

      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      totalDeleted += snap.size;
      console.log(`[expireManualDeals] ${source}: deleted ${snap.size}`);
    }

    console.log(`[expireManualDeals] Total deleted: ${totalDeleted}`);
  }
);
