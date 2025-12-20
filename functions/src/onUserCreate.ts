import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * onUserUpdate
 * Runs whenever an existing user's document changes.
 * Keeps preferences valid, fills missing fields, and logs important changes.
 */
export const onUserUpdate = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const userId = context.params.userId;
    const before = change.before.data();
    const after = change.after.data();

    if (!after) return console.warn(`⚠️ Missing data for user ${userId}`);

    const updates: Record<string, any> = {};
    let logChanges: string[] = [];

    // 🏷️ Ensure dealCategories exist and are valid
    if (
      !after.dealCategories ||
      !Array.isArray(after.dealCategories) ||
      after.dealCategories.length === 0
    ) {
      updates.dealCategories = ["tech", "auto", "groceries", "fashion", "general"];
      logChanges.push("dealCategories reset to defaults");
    }

    // 📍 Ensure location exists
    if (!after.location || !after.location.latitude || !after.location.longitude) {
      updates.location = before?.location || {
        latitude: 41.8781,
        longitude: -87.6298,
      };
      logChanges.push("location re-initialized");
    }

    // 📏 Ensure radius
    if (!after.radius || typeof after.radius !== "number") {
      updates.radius = 10;
      logChanges.push("radius set to default 10");
    }

    // 💎 Premium and subscription sync
    if (after.isPremium && after.subscriptionStatus !== "premium") {
      updates.subscriptionStatus = "premium";
      logChanges.push("subscriptionStatus synced to premium");
    } else if (!after.isPremium && after.subscriptionStatus === "premium") {
      updates.subscriptionStatus = "free";
      logChanges.push("subscriptionStatus synced to free");
    }

    // 🕒 Always update timestamp
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await db.collection("users").doc(userId).set(updates, { merge: true });
      console.log(
        `🔁 User ${userId} preferences auto-corrected: ${logChanges.join(", ")}`
      );
    } else {
      console.log(`✅ User ${userId} up-to-date.`);
    }
  });
