// functions/upgradeReferrals.mjs
import admin from "firebase-admin";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
const app = admin.initializeApp({ projectId: "flashradar-71c93" });
const db = admin.firestore();

async function upgradeReferrals() {
  const refSnap = await db.collection("referrals").get();
  for (const doc of refSnap.docs) {
    await doc.ref.update({
      status: "premium",
      referrerUid: doc.data().referrerId,
    });
    console.log(`⭐ Upgraded ${doc.id} → premium`);
  }
  process.exit(0);
}

upgradeReferrals();
