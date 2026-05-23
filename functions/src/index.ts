// functions/src/index.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

import "./imageProxy";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────
// CORE / BILLING
// ─────────────────────────────────────────────
export { stripeWebhook } from "./stripeWebhook";
export { createCheckoutSession } from "./createCheckoutSession";
export { createBillingPortal } from "./createBillingPortal";

// ─────────────────────────────────────────────
// REFERRALS / PREMIUM
// ─────────────────────────────────────────────
export { recordReferral } from "./recordReferral";
export { rewardMilestone } from "./rewardMilestone";
export { expirePremiumUsers } from "./expirePremiumUsers";
export { runExpireCheck } from "./runExpireCheck";
export { checkReferralRewards } from "./checkReferralRewards";
export { syncSubscriptions } from "./syncSubscriptions";
export { runReferralCheck } from "./runReferralCheck";
export { onReferralUpdate } from "./referralRewardHandler";
export { onUserCreate } from "./referralSystem";
export { onUserUpdate } from "./onUserUpdate";

// ─────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────
export { sendDealAlerts } from "./sendDealAlerts";

// ─────────────────────────────────────────────
// DEAL INGESTION — PROPRIETARY SOURCES
// ─────────────────────────────────────────────
export { fetchWalmartDealsSlick } from "./fetchWalmartDealsSlick";
export { fetchTargetDeals } from "./fetchTargetDeals";
export { fetchNikeDeals } from "./fetchNikeDeals";
export { fetchPumaDeals } from "./fetchPumaDeals";
export { fetchSephoraDeals } from "./fetchSephoraDeals";
export { fetchAmazonDealsKeepa } from "./fetchAmazonDealsKeepa";
export { fetchAmazonLightningDeals } from "./fetchAmazonLightningDeals";
export { fetchAmazonLightningDealsNow } from "./fetchAmazonLightningDealsNow";
export { fetchAmazonProductsFromAsins } from "./fetchAmazonProductsFromAsins";
export { fetchKeepaAllDeals } from "./fetchKeepaAllDeals";
export { seedKeepaAsinPool } from "./seedKeepaAsinPool";
export { seedKeepaDealFinder } from "./seedKeepaDealFinder";
export { seedKeepaCategory } from "./seedKeepaCategory";
export { ingestAmazonAsins } from "./ingestAmazonAsins";
export { walmartRunNow } from "./walmartRunNow";
export { refreshBrokenImages } from "./refreshBrokenImages";
export { watchDealUrlChanges } from "./watchDealUrlChanges";
export { enrichDealV3 } from "./enrichDealV3";
export { autoEnrichDeal } from "./autoEnrichDeal";

// ─────────────────────────────────────────────
// DEAL LIFECYCLE
// ─────────────────────────────────────────────
export { expireAmazonDeals } from "./expireAmazonDeals";
export { expireLightningDeals } from "./expireLightningDeals";
export { notifyLightningEndingSoon } from "./notifyLightningEndingSoon";
export { purgeExpiredDeals } from "./purgeExpiredDeals";
export { purgeDeadAsins } from "./purgeDeadAsins";
export { bridgeDealsOnlineToDeals } from "./bridgeDealsOnlineToDeals";

// ─────────────────────────────────────────────
// SCHEDULED CRONS — PROPRIETARY ONLY
// ─────────────────────────────────────────────

// Walmart — every 30 min
export const walmartCron = onSchedule(
  { schedule: "every 30 minutes", timeZone: "America/Chicago" },
  async () => {
    await fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/walmartRunNow");
  }
);

// Amazon Lightning — every 15 min (time-sensitive)
export const lightningCron = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Chicago" },
  async () => {
    await fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchAmazonLightningDealsNow");
  }
);

// Nike + Puma + Sephora — every 4 hours
export const brandDealsCron = onSchedule(
  { schedule: "every 4 hours", timeZone: "America/Chicago" },
  async () => {
    await Promise.all([
      fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchNikeDeals"),
      fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchPumaDeals"),
      fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchSephoraDeals"),
    ]);
  }
);

// Enrichment worker — every 5 min
export { enrichDealsWorker } from "./enrichDealsWorker";

// ─────────────────────────────────────────────
// DAILY QUALITY PURGE
// Removes low-quality deals that slip through ingestion filters.
// Runs once per day automatically — no manual purging needed.
// ─────────────────────────────────────────────
export const dailyQualityPurge = onSchedule(
  { schedule: "every 24 hours", region: "us-central1", timeZone: "America/Chicago" },
  async () => {
    let totalPurged = 0;

    // eBay — only keep 50%+ off
    const ebaySnap = await db.collection("deals_live")
      .where("storeKey", "==", "ebay")
      .limit(500).get();
    const ebayBad = ebaySnap.docs.filter(d => (d.data().discountPercent ?? 0) < 50);
    if (ebayBad.length > 0) {
      const batch = db.batch();
      ebayBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += ebayBad.length;
      console.log(`[purge] eBay removed: ${ebayBad.length}`);
    }

    // Nike — only keep 35%+ off
    const nikeSnap = await db.collection("deals_live")
      .where("storeKey", "==", "nike")
      .limit(500).get();
    const nikeBad = nikeSnap.docs.filter(d => (d.data().discountPercent ?? 0) < 35);
    if (nikeBad.length > 0) {
      const batch = db.batch();
      nikeBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += nikeBad.length;
      console.log(`[purge] Nike removed: ${nikeBad.length}`);
    }

    // Unknown store — always remove
    const unknownSnap = await db.collection("deals_live")
      .where("storeKey", "==", "unknown")
      .limit(500).get();
    if (unknownSnap.size > 0) {
      const batch = db.batch();
      unknownSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += unknownSnap.size;
      console.log(`[purge] Unknown removed: ${unknownSnap.size}`);
    }

    console.log(`[dailyQualityPurge] Total purged: ${totalPurged}`);
  }
);

// ─────────────────────────────────────────────
// FLIP / PRICE ALERTS
// ─────────────────────────────────────────────
export { onFlipPriceUpdate } from "./flipAlerts";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
export { amazonLookup } from "./amazonLookup";
export { parseProduct } from "./parseProduct";
export { resolveTitle } from "./resolveTitle";
export { detectSoldPrice } from "./detectSoldPrice";
export { previewDealV2 } from "./previewDeal";
export { getPrintfulProducts } from "./getPrintfulProducts";