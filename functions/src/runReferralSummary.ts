import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore"; // ✅ fixes serverTimestamp error
import * as logger from "firebase-functions/logger";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * 📊 Aggregates payout totals for all users.
 * Manual trigger (secure): https://us-central1-flashradar-71c93.cloudfunctions.net/runReferralSummary?key=FLASHRADAR2025
 */
export const runReferralSummary = functions.onRequest(
  { region: "us-central1", timeoutSeconds: 120 },
  async (req, res) => {
    const key = req.query.key;
    if (key !== "FLASHRADAR2025") {
      res.status(403).send("Forbidden: invalid key");
      return;
    }

    try {
      logger.info("📊 Starting referral summary aggregation...");

      const payoutsSnap = await db.collection("payouts").get();
      if (payoutsSnap.empty) {
        logger.warn("⚠️ No payouts found in collection.");
        res.status(200).send({ success: true, updated: 0 });
        return;
      }

      const totals: Record<string, number> = {};

      payoutsSnap.forEach((doc) => {
        const data = doc.data();
        const uid = data.uid;
        const amount = Number(data.amount) || 0;

        if (!uid) {
          logger.warn(`⚠️ Skipping payout without uid (doc: ${doc.id})`);
          return;
        }

        logger.info(
          `💰 Counting payout for ${uid}: +$${amount.toFixed(2)} (${doc.id})`
        );

        totals[uid] = (totals[uid] || 0) + amount;
      });

      let updated = 0;
      for (const [uid, total] of Object.entries(totals)) {
        await db
          .collection("users")
          .doc(uid)
          .collection("summary")
          .doc("earnings")
          .set(
            {
              totalEarnings: total,
              lastUpdated: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        updated++;
        logger.info(`✅ Updated summary for ${uid}: $${total.toFixed(2)}`);
      }

      logger.info(`✅ Referral summary completed for ${updated} user(s).`);
      res.status(200).send({ success: true, updated });
    } catch (err) {
      logger.error("❌ Error building referral summary:", err);
      res.status(500).send("Error creating referral summary");
    }
  }
);
