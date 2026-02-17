import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const watchDealUrlChanges = onDocumentUpdated(
  "deals_online/{dealId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    const beforeUrl =
      before.affiliateUrl || before.merchantUrl || before.url || null;

    const afterUrl =
      after.affiliateUrl || after.merchantUrl || after.url || null;

    // ⛔ No URL change → do nothing
    if (beforeUrl === afterUrl) return;

    console.log(
      `🔁 URL changed → requeue image for deal ${event.params.dealId}`
    );

    await event.data?.after.ref.set(
      {
        imageBroken: true,
        imagePermanentlyDisabled: false,
        imageRetryCount: 0,
        imageCheckedAt: 0,
        imageRequeuedAt:
          admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);
