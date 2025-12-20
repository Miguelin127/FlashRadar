// functions/testRewardMilestone.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function triggerRewardMilestone() {
  console.log("🎯 Running rewardMilestone test...");

  const userId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const userRef = db.collection("users").doc(userId);

  // Simulate reward being ready to grant
  await userRef.update({
    rewardUnlocked: true,
    rewardGranted: false,
    referralCount: 10,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Updated user for rewardMilestone test.");
  console.log("👉 Now watching emulator logs for rewardMilestone execution...");
  process.exit(0);
}

triggerRewardMilestone().catch((err) => {
  console.error("❌ Error running rewardMilestone test:", err);
  process.exit(1);
});
