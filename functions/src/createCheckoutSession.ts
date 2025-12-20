import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import * as admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const stripeSecret = defineSecret("STRIPE_SECRET_KEY");

export const createCheckoutSession = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    secrets: [stripeSecret],
  },
  async (req, res): Promise<void> => {
    try {
      const { uid, plan } = req.body;
      if (!uid || !plan) {
        res.status(400).send("Missing uid or plan type.");
        return;
      }

      // ✅ Initialize Stripe with correct API version
      const stripe = new Stripe(stripeSecret.value(), {
        apiVersion: "2025-08-27.basil",
      });

      // ✅ Define your price IDs
      const PRICE_ID_MONTHLY = "price_1RftmB3O74XdFZMCBFyrFWbo"; // your current Premium monthly
      const PRICE_ID_YEARLY = "price_1RftmB3O74XdFZMCBFyrFWbo"; // optional: replace if you add yearly

      const selectedPrice =
        plan === "yearly" ? PRICE_ID_YEARLY : PRICE_ID_MONTHLY;

      // ✅ Create Checkout Session with 3-day free trial
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_creation: "always",
        subscription_data: {
          trial_period_days: 3,
          metadata: { uid },
        },
        line_items: [
          {
            price: selectedPrice,
            quantity: 1,
          },
        ],
        success_url: "https://flashradarapp.com/success",
        cancel_url: "https://flashradarapp.com/cancel",
      });

      // ✅ Record session for debugging
      await db.collection("checkout_sessions").add({
        uid,
        sessionId: session.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        plan,
        trialDays: 3,
        status: "created",
      });

      res.json({ url: session.url });
    } catch (error: any) {
      logger.error("❌ Error creating checkout session:", error);
      res.status(500).send(error.message);
    }
  }
);
