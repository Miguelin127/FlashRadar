import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const createBillingPortal = onRequest(
  { region: "us-central1", secrets: ["STRIPE_SECRET_KEY"], memory: "256MiB" },
  async (req, res): Promise<void> => {
    try {
      const { uid } = req.body;
      if (!uid) {
        res.status(400).json({ error: "Missing user ID" });
        return;
      }

      const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
        apiVersion: "2025-05-28.basil" as any,
      });

      const userDoc = await db.collection("users").doc(uid).get();
      const customerId = userDoc.data()?.stripeCustomerId;

      if (!customerId) {
        res.status(400).json({ error: "Missing Stripe customer ID" });
        return;
      }

      // ✅ Use your portal config ID explicitly
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        configuration: "bpc_1SJPtFKww54DDib4YaOzDFtE",
        return_url: "https://flashradar.app/settings",
      });

      res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error("💥 Billing portal error:", err);
      res.status(500).json({ error: err.message || "Error creating billing portal" });
    }
  }
);
