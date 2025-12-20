import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🔒 Secure key loaded from Firebase Secret Manager
const expireKey = defineSecret("EXPIRE_CHECK_KEY");

export const runExpireCheck = onRequest(
  { secrets: [expireKey] },
  async (req, res) => {
    try {
      const key = req.query.key;

      if (key !== expireKey.value()) {
        logger.warn("❌ Unauthorized access attempt detected.");
        res.status(403).send("Forbidden: Invalid key.");
        return;
      }

      logger.info("✅ Authorized manual Premium expiration check running...");
      const now = new Date();

      const snapshot = await db
        .collection("users")
        .where("isPremium", "==", true)
        .get();

      let expiredCount = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const expiresAt = data.premiumExpiresAt?.toDate?.() || null;

        if (expiresAt && expiresAt < now) {
          await docSnap.ref.update({
            isPremium: false,
            premiumExpiresAt: null,
            rewardUnlocked: null,
          });
          expiredCount++;
        }
      }

      const message = `✅ Secure expiration check complete. Downgraded ${expiredCount} user(s).`;
      logger.info(message);
      res.status(200).send(message);
    } catch (error) {
      logger.error("❌ Error during manual expiration check:", error);
      res.status(500).send("Error running expiration check.");
    }
  }
);
