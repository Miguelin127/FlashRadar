import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fetch from "node-fetch";

// Initialize Firebase Admin (safe to call multiple times)
initializeApp();
const db = getFirestore();

type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
};

async function sendExpoPush(payload: PushPayload) {
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

/**
 * Trigger when a new notification doc is created
 * collection: notifications/{id}
 */
export const sendPushOnNotificationCreate = onDocumentCreated(
  "notifications/{id}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const notif = snap.data();
    if (!notif?.uid) return;

    const userSnap = await db.doc(`users/${notif.uid}`).get();
    const user = userSnap.data();

    if (!user?.pushEnabled || !user?.pushToken) return;

    await sendExpoPush({
      to: user.pushToken,
      title: notif.title ?? "FlashRadar Alert",
      body: notif.message ?? "New update",
      data: { type: notif.type ?? "generic" },
    });
  }
);
