import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { runEnrichment } from "./enrichDealV3";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/*
  This worker runs every 5 minutes
  and enriches deals that have not
  been processed yet.
*/

export const enrichDealsWorker = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB"
  },
  async () => {

    const snapshot = await db
      .collection("deals_online")
      .where("enrichmentStatus", "in", ["pending", "queued"])
      .limit(20)
      .get();

    if (snapshot.empty) {
      console.log("No deals to enrich");
      return;
    }

    const jobs: Promise<any>[] = [];

    snapshot.docs.forEach((doc) => {

      const dealId = doc.id;

      jobs.push(
        runEnrichment(dealId).catch((err) => {
          console.error("Enrichment failed:", dealId, err);
        })
      );

    });

    await Promise.all(jobs);

    console.log("Processed deals:", snapshot.size);

  }
);