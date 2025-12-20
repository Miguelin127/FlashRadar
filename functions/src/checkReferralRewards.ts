// functions/src/checkReferralRewards.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * 🎁 Runs every 24 hours — unlocks rewards for users with ≥5 referrals
 */
export const checkReferralRewards = onSchedule(
  {
    schedule: "every 24 hours",
    region: "us-central1",
    timeZone: "America/Chicago",
  },
  async () => {
    try {
      const usersSnap = await db.collection("users").get();
      let updatedCount = 0;

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;

        // Count only PREMIUM referrals
        const referralsSnap = await db
          .collection("referrals")
          .where("referrerUid", "==", userId)
          .where("status", "==", "premium")
          .get();

        const referralCount = referralsSnap.size;
        const rewardUnlocked = referralCount >= 5;

        const current = userDoc.data().rewardUnlocked || false;
        if (rewardUnlocked !== current) {
          await userDoc.ref.update({ rewardUnlocked });
          updatedCount++;
          logger.info(`✅ Updated reward for ${userId} (${referralCount} referrals)`);
        }
      }

      logger.info(`🎯 Reward check complete. Updated ${updatedCount} users.`);
    } catch (error) {
      logger.error("❌ Error running reward check:", error);
    }
  }
);

/**
 * 🧩 Manual secure endpoint — trigger manually from browser or Postman
 * Example: https://us-central1-flashradar-71c93.cloudfunctions.net/runReferralCheck?key=FLASHRADAR2025
 */
export const runReferralCheck = functions.https.onRequest(async (req, res) => {
  const key = req.query.key;
  if (key !== "FLASHRADAR2025") {
    res.status(403).send("Forbidden: Invalid key.");
    return;
  }

  try {
    logger.info("🟢 Manual referral reward check started...");
    const usersSnap = await db.collection("users").get();
    let updatedCount = 0;
    const updatedUsers: string[] = [];

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;

      const referralsSnap = await db
        .collection("referrals")
        .where("referrerUid", "==", userId)
        .where("status", "==", "premium")
        .get();

      const referralCount = referralsSnap.size;
      const rewardUnlocked = referralCount >= 5;

      const current = userDoc.data().rewardUnlocked || false;
      if (rewardUnlocked !== current) {
        await userDoc.ref.update({ rewardUnlocked });
        updatedCount++;
        updatedUsers.push(userId);
      }
    }

    logger.info(`✅ Manual check complete. Updated ${updatedCount} users.`);
    res.status(200).send({
      success: true,
      updatedCount,
      updatedUsers,
    });
  } catch (error) {
    logger.error("❌ Error in manual referral check:", error);
    res.status(500).send("Error running manual referral check.");
  }
});
