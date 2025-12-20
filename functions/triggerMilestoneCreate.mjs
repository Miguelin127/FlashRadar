// functions/triggerMilestoneCreate.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function createReferredUser() {
  console.log("👤 Creating new referred user to trigger rewardMilestone...");

  const referredBy = "Ua12T5IJtLRYlflZMGnZX8BeZEb2"; // referrer
  const newUserId = `testUser_${Date.now()}`;

  await db.collection("users").doc(newUserId).set({
    email: `${newUserId}@example.com`,
    city: "Chicago",
    state: "Illinois",
    referredBy,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Created referred user: ${newUserId}`);
  process.exit(0);
}

createReferredUser().catch((err) => {
  console.error("❌ Error creating referred user:", err);
  process.exit(1);
});
