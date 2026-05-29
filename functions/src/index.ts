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
export { fetchHomeDepotDeals } from "./fetchHomeDepotDeals";
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // eBay — only keep 30%+ off
    const ebaySnap = await db.collection("deals_live")
      .where("storeKey", "==", "ebay")
      .limit(500).get();
    const ebayBad = ebaySnap.docs.filter(d => (d.data().discountPercent ?? 0) < 30);
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

    // Purge deals with no image
    const noImageSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["walmart", "target", "bestbuy", "homedepot"])
      .limit(500).get();
    const noImageBad = noImageSnap.docs.filter(d => {
      const data = d.data();
      return !data.imageUrl && !data.image;
    });
    if (noImageBad.length > 0) {
      const batch = db.batch();
      noImageBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += noImageBad.length;
      console.log(`[purge] No-image retail deals removed: ${noImageBad.length}`);
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

    // Online deals (Amazon, eBay) — delete after 7 days
    const onlineSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["amazon", "ebay", "newegg", "lenovo"])
      .where("createdAt", "<", sevenDaysAgo)
      .limit(500).get();
    if (onlineSnap.size > 0) {
      const batch = db.batch();
      onlineSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += onlineSnap.size;
      console.log(`[purge] Online deals expired: ${onlineSnap.size}`);
    }

    // In-store deals (Walmart, Target, Home Depot) — mark expired after 7 days
    const inStoreSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["walmart", "target", "homedepot"])
      .where("createdAt", "<", sevenDaysAgo)
      .limit(500).get();
    const staleDocs = inStoreSnap.docs.filter(d => !d.data().expired);
    if (staleDocs.length > 0) {
      const batch = db.batch();
      staleDocs.forEach(d => batch.update(d.ref, { expired: true }));
      await batch.commit();
      console.log(`[purge] In-store deals marked expired: ${staleDocs.length}`);
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