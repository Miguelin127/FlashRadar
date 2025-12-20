// functions/src/createPortalSession.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import express, { Request, Response } from "express";

// ✅ Secure secret
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

const app = express();
app.use(express.json());

// ✅ Create Stripe customer portal session
app.post("/", async (req: Request, res: Response) => {
  try {
    const { uid } = req.body as { uid?: string };

    if (!uid) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
      apiVersion: "2025-05-28.basil" as any,
    });

    // ✅ Find or create a customer linked to this user
    const customers = await stripe.customers.list({ limit: 100 });
    const customer = customers.data.find((c) => c.metadata?.uid === uid);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // ✅ Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: "https://flashradar.app/settings",
    });

    console.log(`🔁 Portal session created for UID: ${uid}`);
    res.status(200).json({ url: portalSession.url });
  } catch (err: any) {
    console.error("❌ Portal session error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Export Firebase Function
export const createPortalSession = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
    memory: "256MiB",
  },
  app
);
