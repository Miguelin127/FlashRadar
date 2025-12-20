// ✅ functions/src/rewardMilestone.ts
import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore"; // ✅ correct import for Firestore constants
import * as logger from "firebase-functions/logger";
import * as sgMail from "@sendgrid/mail";
import { defineSecret } from "firebase-functions/params";

// 🔐 Secrets
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const FCM_SERVER_KEY = defineSecret("FCM_SERVER_KEY");

// ⚙️ Initialize Firebase Admin
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🎯 Reward tiers
const rewardTiers = [
  { count: 1, reward: "7 Days Premium", premiumDays: 7 },
  { count: 5, reward: "1 Month Premium", premiumDays: 30 },
  { count: 10, reward: "3 Months Premium", premiumDays: 90 },
  { count: 50, reward: "Lifetime Premium", premiumDays: 9999 },
  { count: 100, reward: "$250 Gift Card", premiumDays: 0 },
];

// 🧮 Helper: expiration date
function getExpirationDate(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return Timestamp.fromDate(now);
}

// ⚡ Trigger: fires when a new referred user doc is created
export const rewardMilestone = functions.onDocumentCreated(
  {
    document: "users/{userId}",
    secrets: [SENDGRID_API_KEY, FCM_SERVER_KEY],
    region: "us-central1",
  },
  async (event) => {
    try {
      const data = event.data?.data();
      if (!data?.referredBy) return;

      const referrerId = data.referredBy;
      const referrerRef = db.collection("users").doc(referrerId);

      // 🔁 Count total referrals
      const referralSnap = await db
        .collection("users")
        .where("referredBy", "==", referrerId)
        .get();
      const referralCount = referralSnap.size;
      logger.info(`🔁 ${referrerId} now has ${referralCount} referrals.`);

      // 🎯 Find unlocked tier
      const unlockedTier = [...rewardTiers]
        .reverse()
        .find((tier) => referralCount >= tier.count);
      if (!unlockedTier) return;

      // 🏅 Create milestone record safely
      try {
        await referrerRef.collection("milestones").add({
          reward: unlockedTier.reward,
          referralCount,
          grantedAt: FieldValue.serverTimestamp(),
          expiresAt:
            unlockedTier.premiumDays > 0
              ? getExpirationDate(unlockedTier.premiumDays)
              : null,
        });
        logger.info(`🏅 Milestone record created for ${referrerId}`);
      } catch (err) {
        logger.error("❌ Failed to write milestone document:", err);
      }

      // 👤 Update referrer user doc
      const userUpdate: Record<string, any> = {
        referralCount,
        reward: unlockedTier.reward,
        lastRewardedAt: FieldValue.serverTimestamp(),
      };
      if (unlockedTier.premiumDays > 0) {
        userUpdate.isPremium = true;
        userUpdate.premiumExpiresAt = getExpirationDate(
          unlockedTier.premiumDays
        );
      }

      await referrerRef.set(userUpdate, { merge: true });
      logger.info(`✅ Updated referrer ${referrerId} with new reward.`);

      // 🔍 Load user data
      const userDoc = await referrerRef.get();
      const userData = userDoc.data() || {};
      const userEmail = userData.email;
      const fcmToken = userData.fcmToken;

      // ✉️ Email notification
      if (userEmail) {
        try {
          sgMail.setApiKey(SENDGRID_API_KEY.value());
          await sgMail.send({
            to: userEmail,
            from: "rewards@flashradar.app",
            subject: `🎉 You just earned ${unlockedTier.reward}!`,
            html: `
              <h2>Congratulations!</h2>
              <p>You’ve reached a new referral milestone with <b>${referralCount}</b> referrals.</p>
              <p><b>Reward:</b> ${unlockedTier.reward}</p>
              ${
                unlockedTier.premiumDays > 0
                  ? `<p>Your premium is now extended until ${getExpirationDate(
                      unlockedTier.premiumDays
                    )
                      .toDate()
                      .toDateString()}.</p>`
                  : ""
              }
              <br/><p>Keep sharing your link and unlock more perks!</p>
            `,
          });
          logger.info(`📧 Reward email sent to ${userEmail}`);
        } catch (err) {
          logger.error("❌ Failed to send reward email:", err);
        }
      }

      // 🔔 Push notification
      if (fcmToken) {
        try {
          const res = await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: "🎉 FlashRadar Milestone Unlocked!",
              body: `You just earned ${unlockedTier.reward} for ${referralCount} referrals.`,
            },
            data: {
              reward: unlockedTier.reward,
              referrals: referralCount.toString(),
            },
          });
          logger.info(`📱 Push notification sent: ${res}`);
        } catch (err) {
          logger.error("❌ Failed to send push notification:", err);
        }
      }

      logger.info(
        `🏆 Reward milestone reached for ${referrerId}: ${unlockedTier.reward}`
      );
    } catch (error) {
      logger.error("💥 Unhandled error in rewardMilestone:", error);
    }
  }
);
