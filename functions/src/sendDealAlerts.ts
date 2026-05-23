import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import fetch from "node-fetch";
import { getDistance } from "geolib";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🔐 Discord webhook from Firebase Secret
const DISCORD_DEALS_WEBHOOK = process.env.DISCORD_DEALS_WEBHOOK;

export const sendDealAlerts = functions.firestore
  .document("deals_live/{dealId}")
  .onCreate(async (snap, context) => {
    const deal = snap.data();
    if (!deal) {
      console.warn("⚠️ No deal data found.");
      return;
    }

    const {
      title,
      price,
      store,
      latitude,
      longitude,
      rare,
      category,
      lightning,
      url,
      listPrice,
    } = deal;

    console.log(
      lightning
        ? `⚡ Lightning deal added: ${title}`
        : `🔥 New deal added: ${title}`
    );

    /* ───────── DISCORD ALERT ───────── */

    if (DISCORD_DEALS_WEBHOOK) {
      const emoji = lightning ? "⚡" : rare ? "🦄" : "🔥";

      const discount =
        listPrice && price
          ? ` (${Math.round(((listPrice - price) / listPrice) * 100)}% off)`
          : "";

      const content = {
        content: `${emoji} **${title}**
💰 $${price}${discount}
🏬 ${store}
🔗 ${url ?? ""}`,
      };

      try {
        await fetch(DISCORD_DEALS_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(content),
        });
        console.log("✅ Discord alert sent");
      } catch (err) {
        console.error("❌ Discord webhook failed:", err);
      }
    }

    /* ───────── PUSH NOTIFICATIONS ───────── */

    const usersSnapshot = await db
      .collection("users")
      .where("pushToken", "!=", null)
      .get();

    if (usersSnapshot.empty) {
      console.warn("⚠️ No users found in Firestore.");
      return;
    }

    const tokens: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();
      if (!user.pushToken || !user.location) continue;

      const userLat = user.location.latitude;
      const userLng = user.location.longitude;

      const distanceMiles =
        getDistance(
          { latitude, longitude },
          { latitude: userLat, longitude: userLng }
        ) / 1609.34;

      const withinRadius = distanceMiles <= (user.radius || 5);
      const isPremiumUser =
        user.isPremium === true || user.subscriptionStatus === "premium";

      const categoryMatch =
        !category ||
        (Array.isArray(user.dealCategories) &&
          user.dealCategories.includes(category));

      if (!categoryMatch) continue;

      // ⚡ Lightning logic
      if (lightning === true) {
        if (withinRadius) tokens.push(user.pushToken);
        continue;
      }

      // 🦄 Rare logic (premium only)
      if (rare === true) {
        if (isPremiumUser && withinRadius) tokens.push(user.pushToken);
        continue;
      }

      // 🔥 Normal deals
      if (withinRadius) {
        tokens.push(user.pushToken);
      }
    }

    if (tokens.length === 0) {
      console.warn("⚠️ No eligible users found.");
      return;
    }

    const notificationTitle = lightning
      ? "⚡ Lightning Deal Live"
      : store || "🛍️ FlashRadar";

    const notificationBody = lightning
      ? `${title} — limited time ⚡`
      : `${title} — $${price}`;

    const messages = tokens.map((token) => ({
      to: token,
      sound: "default",
      title: notificationTitle,
      body: notificationBody,
      data: {
        dealId: context.params.dealId,
        store,
        price,
        rare: rare === true,
        lightning: lightning === true,
        category,
      },
      priority: lightning ? "high" : "default",
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
