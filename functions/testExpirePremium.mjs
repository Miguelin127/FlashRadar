// functions/testExpirePremium.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function simulateExpiration() {
  const userId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const userRef = db.collection("users").doc(userId);

  // ⏳ Set expiration to yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await userRef.update({
    isPremium: true,
    premiumExpiresAt: admin.firestore.Timestamp.fromDate(yesterday),
  });

  console.log("✅ User expiration date moved to the past.");
  process.exit(0);
}

simulateExpiration().catch((err) => {
  console.error("❌ Error simulating expiration:", err);
  process.exit(1);
});
