// functions/testStripeRenewal.mjs
import admin from "firebase-admin";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function simulateRenewal() {
  const userId = "Ua12T5IJtLRYlflZMGnZX8BeZEb2";
  const stripeCustomerId = "cus_test_premium"; // matches your existing record

  // Simulate renewal via webhook effect
  await db.collection("users").doc(userId).update({
    subscriptionStatus: "active",
    isPremium: true,
    premiumExpiresAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
    ),
    updatedAt: new Date(),
  });

  console.log("✅ Simulated Stripe renewal → Premium reactivated.");
  process.exit(0);
}

simulateRenewal().catch((err) => {
  console.error("❌ Error simulating renewal:", err);
  process.exit(1);
});
