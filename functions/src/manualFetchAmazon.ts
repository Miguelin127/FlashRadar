// functions/src/manualFetchAmazon.ts

import { onRequest } from "firebase-functions/v2/https";
import { fetchAmazonLightningDeals } from "./fetchAmazonLightningDeals";

export const manualFetchAmazon = onRequest(async (_req, res) => {
  try {
    await fetchAmazonLightningDeals.run({
  scheduleTime: new Date().toISOString(),
});
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err?.message });
  }
});
