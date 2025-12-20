// functions/src/createPortalLink.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// ✅ Initialize Firebase Admin
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ✅ Stripe Secret Key from Firebase Secrets
const stripeSecret = defineSecret("STRIPE_SECRET_KEY");

export const createPortalLink = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    secrets: [stripeSecret],
  },
  async (req, res): Promise<void> => {
    try {
      // ✅ Validate request body
      const { uid } = req.body as { uid?: string };
      if (!uid) {
        res.status(400).send("Missing user ID (uid)");
        return;
      }

      // ✅ Fetch user document to get Stripe customer ID
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        res.status(404).send("User not found in Firestore");
        return;
      }

      const userData = userSnap.data();
      const stripeCustomerId = userData?.stripeCustomerId;

      if (!stripeCustomerId) {
        res.status(400).send("User does not have a Stripe customer ID");
        return;
      }

      // ✅ Initialize Stripe client
      const stripe = new Stripe(stripeSecret.value(), {
        apiVersion: "2025-05-28.basil" as any,
      });

      // ✅ Create a billing portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: "https://flashradar.app/settings", // 👈 return URL after managing subscription
      });

      logger.info(`✅ Created portal session for UID: ${uid}`);

      // ✅ Send portal URL back to app
      res.status(200).json({ url: portalSession.url });
    } catch (error: any) {
      logger.error(`❌ Error creating portal link: ${error.message}`);
      res.status(500).send(`Server Error: ${error.message}`);
    }
  }
);
