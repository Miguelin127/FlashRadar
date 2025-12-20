import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// ✅ Initialize Firebase Admin
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ✅ Stripe secrets
const stripeSecret = defineSecret("STRIPE_SECRET_KEY");
const webhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    rawBody: true,
    secrets: [stripeSecret, webhookSecret],
  },
  async (req, res): Promise<void> => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).send("Missing Stripe signature header");
      return;
    }

    const buf = Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(
          typeof req.rawBody === "string"
            ? req.rawBody
            : JSON.stringify(req.rawBody)
        );

    try {
      const stripe = new Stripe(stripeSecret.value(), {
        apiVersion: "2025-08-27.basil",
      });

      const event = stripe.webhooks.constructEvent(
        buf,
        sig,
        webhookSecret.value()
      );

      logger.info(`✅ Verified Stripe event: ${event.type}`);

      switch (event.type) {
        // 🔹 Trial begins or checkout completes
        case "checkout.session.completed":
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const uid = subscription.metadata?.uid;
          const customerId = subscription.customer as string;
          const status = subscription.status;
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null;

          if (!uid) {
            logger.warn("⚠️ Missing UID in subscription metadata");
            break;
          }

          const userRef = db.collection("users").doc(uid);

          // ✅ Mark as Premium during trial or active
          if (status === "trialing" || status === "active") {
            await userRef.set(
              {
                premium: true,
                trialActive: status === "trialing",
                subscriptionStatus: status,
                trialEnds: trialEnd,
                stripeCustomerId: customerId,
                updatedAt: new Date(),
              },
              { merge: true }
            );

            logger.info(
              `🎉 User ${uid} upgraded — status=${status}, trialEnds=${trialEnd}`
            );

            // ✅ Generate referral code if none exists
            const userDoc = await userRef.get();
            if (!userDoc.data()?.referralCode) {
              const referralCode = `FR-${Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase()}`;
              await userRef.update({ referralCode });
              logger.info(`🎁 Referral code created for ${uid}: ${referralCode}`);
            }

            // ✅ Reward referrer on first Premium conversion
            try {
              const referralSnap = await db
                .collection("referrals")
                .where("referredUid", "==", uid)
                .where("status", "in", ["pending", "started"])
                .limit(1)
                .get();

              if (!referralSnap.empty) {
                const referralDoc = referralSnap.docs[0];
                const referrerUid = referralDoc.data().referrerUid;

                await referralDoc.ref.update({
                  status: "premium",
                  upgradedAt: new Date(),
                });

                // Add payout entry
                await db.collection("payouts").add({
                  uid: referrerUid,
                  amount: 5.0,
                  description: "Referral reward - Premium signup",
                  date: new Date().toISOString(),
                });

                // Increment total earnings
                await db
                  .collection("users")
                  .doc(referrerUid)
                  .set(
                    {
                      totalEarnings: admin.firestore.FieldValue.increment(5.0),
                    },
                    { merge: true }
                  );

                logger.info(`💰 Payout processed for referrer: ${referrerUid}`);
              }
            } catch (err) {
              logger.error("Error rewarding referrer:", err);
            }
          }

          // ⛔ If trial or sub canceled
          if (status === "canceled" || status === "unpaid") {
            await userRef.set(
              {
                premium: false,
                trialActive: false,
                subscriptionStatus: status,
                updatedAt: new Date(),
              },
              { merge: true }
            );
            logger.info(`❌ Premium removed for ${uid}`);
          }
          break;
        }

        // 🔹 Payment failed
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;
          logger.warn(`⚠️ Payment failed for ${customerId}`);

          const usersSnap = await db
            .collection("users")
            .where("stripeCustomerId", "==", customerId)
            .get();

          usersSnap.forEach((doc) => {
            doc.ref.set(
              {
                subscriptionStatus: "past_due",
                premium: false,
                updatedAt: new Date(),
              },
              { merge: true }
            );
          });
          break;
        }

        // 🔹 Subscription deleted (end of trial or cancellation)
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const uid = subscription.metadata?.uid;

          if (uid) {
            await db.collection("users").doc(uid).set(
              {
                premium: false,
                trialActive: false,
                subscriptionStatus: "canceled",
                updatedAt: new Date(),
              },
              { merge: true }
            );
            logger.info(`🚫 Subscription deleted — user ${uid} downgraded.`);
          }
          break;
        }

        default:
          logger.info(`ℹ️ Unhandled event type: ${event.type}`);
      }

      res.status(200).send({ received: true });
    } catch (err: any) {
      logger.error(`❌ Webhook verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
