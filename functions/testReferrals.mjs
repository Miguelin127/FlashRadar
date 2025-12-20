// functions/testReferrals.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// ✅ Add explicit project ID so Firestore knows which emulator project to use
const app = admin.initializeApp({
  projectId: "flashradar-71c93",
});

const db = admin.firestore();

async function simulateReferrals() {
  console.log("🔥 Starting referral milestone test...");

  const referrerId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const referrerRef = db.collection("users").doc(referrerId);

  for (let i = 1; i <= 10; i++) {
    const referralId = `referral_${i}`;
    await db.collection("referrals").doc(referralId).set({
      referrerId,
      referredUserId: `testUser_${i}`,
      status: "completed",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Added referral ${i}/10`);
  }

  await referrerRef.set(
    {
      referralCount: 10,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("🎯 Simulated 10 completed referrals for milestone reward test!");
  process.exit(0);
}

simulateReferrals().catch((err) => {
  console.error("❌ Error during referral test:", err);
  process.exit(1);
});
