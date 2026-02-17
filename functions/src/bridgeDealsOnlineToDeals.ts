import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * 🔁 BRIDGE: deals_online → deals
 * Triggers alerts automatically
 */
export const bridgeDealsOnlineToDeals = functions.firestore
  .document("deals_online/{dealId}")
  .onCreate(async (snap, context) => {
    const deal = snap.data();
    if (!deal) return;

    const dealId = context.params.dealId;

    await db
      .collection("deals")
      .doc(dealId)
      .set(deal, { merge: true });

    console.log(`🔁 Bridged deal ${dealId} → deals`);
  });
