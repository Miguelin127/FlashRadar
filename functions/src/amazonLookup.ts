import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * ✅ V1 Callable (COMPAT SAFE)
 * Backend-only Amazon deal ingestion
 */
export const amazonLookup = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    const { url } = data;

    if (!url || typeof url !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing or invalid Amazon URL"
      );
    }

    /**
     * 🔧 TEMP SAFE PARSE (NO SCRAPING YET)
     * You already confirmed this wiring works
     */
    const title = "Amazon Product Test";
    const buyPrice = 49.99;

    // Optional placeholders (future)
    const originalPrice = 79.99;
    const discountPercent = Math.round(
      ((originalPrice - buyPrice) / originalPrice) * 100
    );

    const deal = {
      title,
      buyPrice,
      originalPrice,
      discountPercent,

      source: "AMAZON",
      affiliateUrl: url,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),

      hot: discountPercent >= 30,
      rare: discountPercent >= 60,
    };

    // ✅ SAVE TO FIRESTORE
    const ref = await db.collection("deals").add(deal);

    return {
      success: true,
      dealId: ref.id,
      deal,
    };
  });
