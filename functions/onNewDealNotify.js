const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.onNewDealNotify = functions.firestore
  .document("deals_online/{dealId}")
  .onCreate(async (snap) => {
    const deal = snap.data();

    if (!deal) return null;

    const level = deal.flashLevel;
    if (!["HOT", "RARE", "UNICORN"].includes(level)) return null;

    const usersSnap = await admin.firestore()
      .collection("users")
      .where("pushEnabled", "==", true)
      .get();

    if (usersSnap.empty) return null;

    const messages = [];

    usersSnap.forEach(doc => {
      const user = doc.data();
      if (!user.expoPushToken) return;

      messages.push({
        to: user.expoPushToken,
        sound: "default",
        title: `${level} Deal Alert 🔥`,
        body: deal.title,
        data: {
          dealId: snap.id,
          store: deal.store,
          flashLevel: level,
        },
      });
    });

    if (messages.length === 0) return null;

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    console.log("Sent notifications:", messages.length);
    return null;
  });
