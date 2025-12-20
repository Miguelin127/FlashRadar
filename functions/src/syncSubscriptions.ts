// functions/src/syncSubscriptions.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import { db, admin } from "./firebase.js";
export const syncSubscriptions = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "America/Chicago",
    region: "us-central1",
  },
  async () => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: "2025-05-28.basil" as any,
    });

    const usersSnap = await db.collection("users").get();

    for (const doc of usersSnap.docs) {
      const userData = doc.data();
      if (!userData.stripeCustomerId) continue;

      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: userData.stripeCustomerId,
          status: "all",
          limit: 1,
        });

        const subscription = subscriptions.data[0];
        const isActive =
          subscription && subscription.status === "active" ? true : false;

        if (userData.premium !== isActive) {
          await doc.ref.set(
            {
              premium: isActive,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          logger.info(`🔄 Corrected premium status for user ${doc.id}`, {
            old: userData.premium,
            new: isActive,
          });
        }
      } catch (err: any) {
        logger.error(`❌ Error syncing user ${doc.id}: ${err.message}`, {
          customerId: userData.stripeCustomerId,
        });
      }
    }
  }
);
