// functions/src/referralRewardHandler.ts
import * as functions from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🎯 Reward thresholds
const rewardTiers = [
  {
    count: 1,
    reward: "Instant Gratification – 7 Days Premium",
    premiumDays: 7,
  },
  {
    count: 5,
    reward: "Flip It Starter Pack – 1 Month Premium",
    premiumDays: 30,
  },
  {
    count: 10,
    reward: "Power User – 3 Months Premium + $25 Gift Card",
    premiumDays: 90,
  },
  {
    count: 50,
    reward: "Radar Elite – Lifetime Premium or $75 Gift Card",
    premiumDays: 9999, // effectively lifetime
  },
  {
    count: 100,
    reward: "Radar Legend – $250 Gift Card + Badge",
    premiumDays: 9999,
  },
];

// 🧠 Helper: calculate expiration date
function getExpirationDate(days: number) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return admin.firestore.Timestamp.fromDate(now);
}

// ⚡ Trigger: when referral count changes
export const onReferralUpdate = functions.onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || !before) return;

    const prevCount = before.referralsCount || 0;
    const newCount = after.referralsCount || 0;
    const userRef = db.collection("users").doc(event.params.userId);

    if (newCount <= prevCount) return; // only trigger on increase

    // Find latest reward unlocked
    const unlocked = rewardTiers.filter((tier) => newCount >= tier.count).slice(-1)[0];
    if (!unlocked) return;

    const updates: Record<string, any> = {
      rewardUnlocked: unlocked.reward,
      lastRewardAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 🏆 Auto-grant premium if applicable
    if (unlocked.premiumDays > 0) {
      updates.isPremium = true;
      updates.premiumExpiresAt = getExpirationDate(unlocked.premiumDays);
    }

    await userRef.set(updates, { merge: true });

    console.log(
      `🎉 ${event.params.userId} unlocked: ${unlocked.reward} (${newCount} referrals)`
    );
  }
);
