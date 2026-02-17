import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";
import fetch from "node-fetch";

export const notifyLightningEndingSoon = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Chicago",
  },
  async () => {
    console.log("⏰ Lightning ending-soon scan");

    const now = Date.now();
    const soon = now + 60 * 60 * 1000;

    const dealsSnap = await db
      .collection("deals_online")
      .where("lightning", "==", true)
      .where("expired", "!=", true)
      .where("endingSoonNotified", "!=", true)
      .get();

    if (dealsSnap.empty) {
      console.log("⚡ No lightning deals eligible");
      return;
    }

    const usersSnap = await db
      .collection("users")
      .where("pushToken", "!=", null)
      .where("isPremium", "==", true)
      .get();

    if (usersSnap.empty) {
      console.log("👤 No premium users with push tokens");
      return;
    }

    const tokens = usersSnap.docs.map((d) => d.data().pushToken);

    const batch = db.batch();
    let sent = 0;

    for (const dealDoc of dealsSnap.docs) {
      const deal = dealDoc.data();

      const expiresAt =
        typeof deal.expiresAt === "number"
          ? deal.expiresAt
          : typeof deal.timestamp === "number"
          ? deal.timestamp + 6 * 60 * 60 * 1000
          : null;

      if (!expiresAt || expiresAt < now || expiresAt > soon) continue;

      const messages = tokens.map((token: string) => ({
        to: token,
        sound: "default",
        title: "⚡ Lightning Deal Ending Soon",
        body: `${deal.title} — ending soon`,
        data: { dealId: dealDoc.id },
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });

      batch.update(dealDoc.ref, {
        endingSoonNotified: true,
        endingSoonNotifiedAt: now,
      });

      sent++;
    }

    if (sent > 0) {
      await batch.commit();
      console.log(`📣 Ending-soon alerts sent for ${sent} deals`);
    } else {
      console.log("✅ No deals within ending-soon window");
    }
  }
);
