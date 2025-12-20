// flashradar/functions/src/expirePremiumUsers.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// ✅ Initialize Firebase Admin once
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * 🔁 Scheduled Function: Runs every 24 hours
 * Checks all Premium users and downgrades those whose subscription expired.
 */
export const expirePremiumUsers = onSchedule(
  {
    schedule: "every 24 hours", // ⏰ adjust if you want more frequent checks
    region: "us-central1",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      const now = new Date();
      const usersRef = db.collection("users");
      const snapshot = await usersRef.where("isPremium", "==", true).get();

      let expiredCount = 0;

      for (const userDoc of snapshot.docs) {
        const data = userDoc.data();
        const expiresAt = data.premiumExpiresAt?.toDate?.() || null;

        if (expiresAt && expiresAt < now) {
          await userDoc.ref.update({
            isPremium: false,
            premiumExpiresAt: null,
            rewardUnlocked: null,
          });
          expiredCount++;
        }
      }

      logger.info(`✅ Premium expiration check complete. Downgraded ${expiredCount} user(s).`);
    } catch (error) {
      logger.error("❌ Error checking premium expirations:", error);
    }
  }
);
