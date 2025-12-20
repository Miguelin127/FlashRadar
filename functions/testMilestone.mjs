// functions/testMilestone.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function triggerMilestoneCheck() {
  console.log("🏁 Running milestone reward test...");

  const userId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const userRef = db.collection("users").doc(userId);

  // Simulate milestone hit by updating referralCount
  await userRef.update({
    referralCount: 10,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log("✅ Updated referralCount to 10. Waiting for functions to trigger...");
  process.exit(0);
}

triggerMilestoneCheck().catch((err) => {
  console.error("❌ Error triggering milestone test:", err);
  process.exit(1);
});
