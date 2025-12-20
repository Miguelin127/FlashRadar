// functions/src/referralSystem.ts

import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import type { UserRecord } from "firebase-admin/auth";
import { db, admin } from "./firebase.js"; // ✅ centralized Firestore + admin

export const onUserCreate = functions.auth
  .user()
  .onCreate(async (user: UserRecord) => {
    try {
      const referralCode = (user as any).referralCode as string | undefined;

      if (!referralCode) {
        logger.info(`User ${user.uid} created without referral code`);
        return;
      }

      const referrerSnap = await db
        .collection("users")
        .where("referralCode", "==", referralCode)
        .limit(1)
        .get();

      if (referrerSnap.empty) {
        logger.warn(`Invalid referral code ${referralCode}`);
        return;
      }

      const referrerDoc = referrerSnap.docs[0];
      const referrerId = referrerDoc.id;
      const referrerData = referrerDoc.data();

      const newCount = (referrerData.referralCount || 0) + 1;

      await referrerDoc.ref.update({
        referralCount: newCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db
        .collection("users")
        .doc(referrerId)
        .collection("referrals")
        .doc(user.uid)
        .set({
          referredUserId: user.uid,
          referredEmail: user.email || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          rewardUnlocked: false,
        });

      const rewardsMap: Record<number, string> = {
        1: "Free 1 Month Premium",
        5: "Exclusive Badge",
        10: "3 Months Premium",
        50: "$75 Debit Card",
        100: "$250 Debit Card",
      };

      if (rewardsMap[newCount]) {
        await referrerDoc.ref.update({
          rewards: admin.firestore.FieldValue.arrayUnion(rewardsMap[newCount]),
        });
        logger.info(
          `🎉 User ${referrerId} unlocked reward: ${rewardsMap[newCount]}`
        );
      }

      logger.info(`Referral processed: ${referrerId} → ${user.uid}`);
    } catch (err: any) {
      logger.error("❌ Error in onUserCreate:", { error: err.message });
    }
  });
