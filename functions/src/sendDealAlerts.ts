import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { getDistance } from "geolib";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const sendDealAlerts = functions.firestore
  .document("deals/{dealId}")
  .onCreate(async (snap, context) => {
    const deal = snap.data();
    if (!deal) return console.warn("⚠️ No deal data found.");

    const { title, price, store, latitude, longitude, rare, category } = deal;
    console.log(`🔥 New deal added: ${title}`);

    const usersSnapshot = await db
      .collection("users")
      .where("pushToken", "!=", null)
      .get();

    if (usersSnapshot.empty) {
      console.warn("⚠️ No users found in Firestore.");
      return;
    }

    let tokens: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      if (!user.pushToken || !user.location) continue;

      const userLat = user.location.latitude;
      const userLng = user.location.longitude;
      const distance =
        getDistance(
          { latitude, longitude },
          { latitude: userLat, longitude: userLng }
        ) / 1609.34; // meters → miles

      const withinRadius = distance <= (user.radius || 5);
      const isPremiumUser =
        user.isPremium || user.subscriptionStatus === "premium";
      const categoryMatch =
        !category ||
        (Array.isArray(user.dealCategories) &&
          user.dealCategories.includes(category));

      if (!categoryMatch) {
        console.log(`🚫 ${userDoc.id} skipped (not subscribed to ${category}).`);
        continue;
      }

      if (rare === true) {
        if (isPremiumUser && withinRadius) tokens.push(user.pushToken);
      } else if (withinRadius) {
        tokens.push(user.pushToken);
      }
    }

    console.log(
      `📍 Sending "${title}" to ${tokens.length} ${
        rare ? "premium" : "nearby"
      } users in category "${category}"...`
    );

    if (tokens.length === 0) return console.warn("⚠️ No eligible users found.");

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: store || "🛍️ FlashRadar",
      body: `${title} — $${price}`,
      data: { dealId: context.params.dealId, store, price, rare, category },
    }));

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messages),
      });
      const result = await response.json();
      console.log("✅ Push alerts result:", JSON.stringify(result, null, 2));
    } catch (err) {
      console.error("❌ Push send failed:", err);
    }
  });
