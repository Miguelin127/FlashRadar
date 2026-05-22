import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { runEnrichment } from "./enrichDealV3";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const autoEnrichDeal = onDocumentCreated(
  {
    document: "deals_online/{dealId}",
    region: "us-central1",
  },
  async (event) => {
    const dealId = event.params.dealId;
    if (!dealId) return;

    try {
      await runEnrichment(dealId);
    } catch (err) {
      console.error("Auto enrichment failed:", err);
    }
  }
);