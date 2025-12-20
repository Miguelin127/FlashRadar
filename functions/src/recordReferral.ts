// functions/src/recordReferral.ts
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ✅ Trigger when user's isPremium changes
export const recordReferral = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const userId = event.params.userId;

  if (!before || !after) return;

  // Only when Premium activates
  if (!before.isPremium && after.isPremium) {
    const referredBy = after.referredBy;
    if (!referredBy) return;

    try {
      const refQuery = await db
        .collection("users")
        .where("referralCode", "==", referredBy)
        .limit(1)
        .get();

      if (refQuery.empty) {
        console.log("❌ No matching referrer found for code:", referredBy);
        return;
      }

      const referrerDoc = refQuery.docs[0];
      const referrerRef = referrerDoc.ref;

      // ✅ Increment referral count
      await referrerRef.set(
        {
          referralCount: admin.firestore.FieldValue.increment(1),
          lastReferralAt: new Date(),
        },
        { merge: true }
      );

      console.log(`✅ Referral recorded for ${referrerDoc.id}`);
    } catch (err) {
      console.error("🔥 Error recording referral:", err);
    }
  }
});
