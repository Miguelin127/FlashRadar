import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Secret key for manual trigger protection
const EXPIRE_CHECK_KEY = defineSecret("EXPIRE_CHECK_KEY");

/**
 * ✅ HTTP function to manually check referral rewards
 * Use: https://runreferralcheck-iep46exe5a-uc.a.run.app?key=FLASHRADAR2025
 */
export const runReferralCheck = onRequest(
  { region: "us-central1", secrets: [EXPIRE_CHECK_KEY] },
  async (req, res) => {
    try {
      const providedKey = req.query.key;
      const secretKey = EXPIRE_CHECK_KEY.value();
      if (providedKey !== secretKey) {
        res.status(403).json({ error: "Unauthorized: Invalid key" });
        return;
      }

      const usersSnap = await db.collection("users").get();
      let updatedCount = 0;
      const updatedUsers: string[] = [];

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;

        // 🔍 Get all referrals where this user is the referrer
        const referralsSnap = await db
          .collection("referrals")
          .where("referrerUid", "==", userId)
          .get();

        const referralCount = referralsSnap.size;
        const rewardUnlocked = referralCount >= 5;
        const currentReward = userDoc.data().rewardUnlocked || false;

        // Log progress
        logger.info(`👤 ${userId} → ${referralCount} referrals (rewardUnlocked=${rewardUnlocked})`);

        // ✅ Update only if changed
        if (rewardUnlocked !== currentReward) {
          await db.collection("users").doc(userId).update({ rewardUnlocked });
          updatedCount++;
          updatedUsers.push(userId);
          logger.info(`✅ Updated ${userId} → rewardUnlocked: ${rewardUnlocked}`);
        }
      }

      logger.info(`🎯 Reward check done. Updated ${updatedCount} users.`);
      res.json({ success: true, updatedCount, updatedUsers });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("❌ Error running referral check:", errMsg);
      res.status(500).json({ success: false, error: errMsg });
    }
  }
);
