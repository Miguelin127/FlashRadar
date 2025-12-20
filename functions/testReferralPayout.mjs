// functions/testReferralPayout.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function simulateReferralPayout() {
  const referrerId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const referredId = `user_${Date.now()}`;

  console.log("👥 Creating referral and simulating Premium upgrade...");

  // 1️⃣  Create referral record (pending)
  await db.collection("referrals").doc(`ref_${referredId}`).set({
    referrerUid: referrerId,
    referredUid: referredId,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 2️⃣  Simulate referred user upgrade (triggers payout logic in stripeWebhook)
  await db.collection("users").doc(referredId).set({
    email: `${referredId}@example.com`,
    stripeCustomerId: `cus_${referredId}`,
    subscriptionStatus: "active",
    isPremium: true,
    upgradedAt: new Date(),
  });

  // 3️⃣  Manually add payout like the webhook would
  await db.collection("payouts").add({
    uid: referrerId,
    amount: 5.0,
    description: "Referral reward - Premium signup",
    date: new Date().toISOString(),
  });

  // 4️⃣  Increment total earnings for referrer
  await db
    .collection("users")
    .doc(referrerId)
    .set(
      { totalEarnings: admin.firestore.FieldValue.increment(5.0) },
      { merge: true }
    );

  console.log("✅ Referral payout simulated successfully!");
  process.exit(0);
}

simulateReferralPayout().catch((err) => {
  console.error("❌ Error during referral payout simulation:", err);
  process.exit(1);
});
