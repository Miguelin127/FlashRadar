import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

/**
 * Admin-only kill switch to instantly expire a deal
 * Input: { dealId: string }
 */
export const adminExpireDeal = onCall(async (request) => {
  const { auth, data } = request;

  // 🔒 Require auth
  if (!auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { dealId } = data || {};

  if (!dealId || typeof dealId !== "string") {
    throw new HttpsError("invalid-argument", "dealId is required.");
  }

  // 🔒 Admin check (simple + safe)
  const userSnap = await db.collection("users").doc(auth.uid).get();
  const user = userSnap.data();

  if (!user || user.isAdmin !== true) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const ref = db.collection("deals_online").doc(dealId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "Deal not found.");
  }

  const now = Date.now();

  await ref.update({
    expired: true,
    expiredAt: now,
    expiredBy: auth.uid,
    expiredReason: "admin_kill_switch",
  });

  return {
    success: true,
    dealId,
    expiredAt: now,
  };
});
