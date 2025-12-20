import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// 🔑 Generates a referral code for a user
export const generateReferralCode = onCall(async (request) => {
  const { uid } = request.data;
  if (!uid) throw new Error("Missing UID");

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) throw new Error("User not found");

  // If they already have a referral code, return it
  const existingCode = userSnap.data()?.referralCode;
  if (existingCode) return { referralCode: existingCode };

  // Generate short random code: FR-XXXXXX
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const referralCode = `FR-${random}`;

  await userRef.update({ referralCode });
  return { referralCode };
});
