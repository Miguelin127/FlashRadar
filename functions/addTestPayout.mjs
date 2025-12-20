// functions/addTestPayout.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function addTestPayout() {
  const uid = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";

  await db.collection("payouts").add({
    uid,
    amount: 5.0,
    description: "Referral reward - Premium signup",
    date: new Date().toISOString(),
  });

  console.log("✅ Added test payout for:", uid);
  process.exit(0);
}

addTestPayout().catch((err) => {
  console.error("❌ Error adding test payout:", err);
  process.exit(1);
});
