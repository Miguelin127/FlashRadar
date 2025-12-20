import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Auto-initialize user preferences on create/update.
 */
export const setUserPreferences = functions.firestore
  .document("users/{userId}")
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const afterData = change.after.exists ? change.after.data() : null;
    if (!afterData) return;

    const ref = db.collection("users").doc(userId);
    const updates: Record<string, any> = {};

    // ✅ Ensure nested location field exists
    if (!afterData.location || !afterData.location.latitude) {
      updates.location = {
        latitude: 41.8781, // Default to Chicago center (fallback)
        longitude: -87.6298,
      };
    }

    // ✅ Ensure radius field exists
    if (!afterData.radius) {
      updates.radius = 10;
    }

    // ✅ Ensure dealCategories field exists
    if (!afterData.dealCategories || !Array.isArray(afterData.dealCategories)) {
      updates.dealCategories = ["tech", "auto", "groceries", "fashion", "general"];
    }

    // ✅ Ensure subscription fields exist
    if (afterData.isPremium === undefined) updates.isPremium = false;
    if (!afterData.subscriptionStatus) updates.subscriptionStatus = "free";

    // ✅ Timestamp
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await ref.set(updates, { merge: true });
      console.log(`⚙️ User ${userId} preferences initialized/updated.`);
    } else {
      console.log(`✅ User ${userId} already configured.`);
    }
  });
