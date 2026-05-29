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
export { fetchInstoreDeals } from "./fetchInstoreDeals";

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

// Target — every 2 hours
export const targetCron = onSchedule(
  { schedule: "every 2 hours", timeZone: "America/Chicago" },
  async () => {
    await fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchTargetDeals");
  }
);

// Home Depot — every 2 hours
export const homeDepotCron = onSchedule(
  { schedule: "every 2 hours", timeZone: "America/Chicago" },
  async () => {
    await fetch("https://us-central1-flashradar-71c93.cloudfunctions.net/fetchHomeDepotDeals");
  }
);

// Enrichment worker — every 5 min
export { enrichDealsWorker } from "./enrichDealsWorker";

// ─────────────────────────────────────────────
// DAILY QUALITY PURGE
// ─────────────────────────────────────────────
export const dailyQualityPurge = onSchedule(
  { schedule: "every 24 hours", region: "us-central1", timeZone: "America/Chicago" },
  async () => {
    let totalPurged = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const STORE_CAPS: Record<string, number> = {
      walmart: 50, target: 30, homedepot: 30,
      amazon: 50, ebay: 50, costco: 30, bestbuy: 30,
      samsclub: 30, lowes: 30, newegg: 20,
      nike: 50, adidas: 30, sephora: 30, footlocker: 20, gamestop: 20,
      macys: 30, nordstrom: 30, bloomingdales: 20, neimanmarcus: 20,
      saks: 20, burlington: 20, tjmaxx: 20, marshalls: 20, ross: 20,
      apple: 20, louisvuitton: 10, gucci: 10, prada: 10, coach: 10,
      lenovo: 20, puma: 20,
    };

    // eBay — only keep 30%+ off
    const ebaySnap = await db.collection("deals_live")
      .where("storeKey", "==", "ebay").get();
    const ebayBad = ebaySnap.docs.filter(d => (d.data().discountPercent ?? 0) < 30);
    if (ebayBad.length > 0) {
      const batch = db.batch();
      ebayBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += ebayBad.length;
      console.log(`[purge] eBay low discount removed: ${ebayBad.length}`);
    }

    // Walmart — only keep 25%+ off
    const walmartSnap = await db.collection("deals_live")
      .where("storeKey", "==", "walmart").get();
    const walmartBad = walmartSnap.docs.filter(d => (d.data().discountPercent ?? 0) < 25);
    if (walmartBad.length > 0) {
      const batch = db.batch();
      walmartBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += walmartBad.length;
      console.log(`[purge] Walmart low discount removed: ${walmartBad.length}`);
    }

    // Nike — only keep 35%+ off
    const nikeSnap = await db.collection("deals_live")
      .where("storeKey", "==", "nike").get();
    const nikeBad = nikeSnap.docs.filter(d => (d.data().discountPercent ?? 0) < 35);
    if (nikeBad.length > 0) {
      const batch = db.batch();
      nikeBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += nikeBad.length;
      console.log(`[purge] Nike low discount removed: ${nikeBad.length}`);
    }

    // Purge no-image deals
    const noImageSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["walmart", "target", "bestbuy", "homedepot"])
      .limit(500).get();
    const noImageBad = noImageSnap.docs.filter(d => !d.data().imageUrl && !d.data().image);
    if (noImageBad.length > 0) {
      const batch = db.batch();
      noImageBad.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += noImageBad.length;
      console.log(`[purge] No-image removed: ${noImageBad.length}`);
    }

    // Unknown store — always remove
    const unknownSnap = await db.collection("deals_live")
      .where("storeKey", "==", "unknown").limit(500).get();
    if (unknownSnap.size > 0) {
      const batch = db.batch();
      unknownSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += unknownSnap.size;
      console.log(`[purge] Unknown removed: ${unknownSnap.size}`);
    }

    // Online deals — delete after 7 days
    const onlineSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["amazon", "ebay", "newegg", "lenovo"])
      .where("createdAt", "<", sevenDaysAgo).limit(500).get();
    if (onlineSnap.size > 0) {
      const batch = db.batch();
      onlineSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalPurged += onlineSnap.size;
      console.log(`[purge] Online deals expired: ${onlineSnap.size}`);
    }

    // In-store deals — mark expired after 7 days
    const inStoreSnap = await db.collection("deals_live")
      .where("storeKey", "in", ["walmart", "target", "homedepot"])
      .where("createdAt", "<", sevenDaysAgo).limit(500).get();
    const staleDocs = inStoreSnap.docs.filter(d => !d.data().expired);
    if (staleDocs.length > 0) {
      const batch = db.batch();
      staleDocs.forEach(d => batch.update(d.ref, { expired: true }));
      await batch.commit();
      console.log(`[purge] In-store marked expired: ${staleDocs.length}`);
    }

    // Dedup — remove duplicate titles per store
    const allSnap = await db.collection("deals_live").get();
    const seenKeys = new Map<string, string>();
    const dupDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    allSnap.docs.forEach(d => {
      const data = d.data();
      const titleKey = (data.title || "")
        .toLowerCase().replace(/[^a-z0-9 ]/g, "")
        .split(" ").filter(Boolean).slice(0, 4).join(" ");
      const key = `${(data.storeKey || "unknown").toLowerCase()}_${titleKey}`;
      if (seenKeys.has(key)) dupDocs.push(d);
      else seenKeys.set(key, d.id);
    });
    if (dupDocs.length > 0) {
      for (let i = 0; i < dupDocs.length; i += 400) {
        const batch = db.batch();
        dupDocs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      totalPurged += dupDocs.length;
      console.log(`[purge] Duplicates removed: ${dupDocs.length}`);
    }

    // Apply store caps — keep top N by discount per store
    const postDedupSnap = await db.collection("deals_live").get();
    const storeGroups: Record<string, admin.firestore.QueryDocumentSnapshot[]> = {};
    postDedupSnap.docs.forEach(d => {
      const key = (d.data().storeKey || "unknown").toLowerCase();
      if (!storeGroups[key]) storeGroups[key] = [];
      storeGroups[key].push(d);
    });

    for (const [store, cap] of Object.entries(STORE_CAPS)) {
      const docs = storeGroups[store] || [];
      if (docs.length <= cap) continue;
      docs.sort((a, b) => (b.data().discountPercent ?? 0) - (a.data().discountPercent ?? 0));
      const excess = docs.slice(cap);
      for (let i = 0; i < excess.length; i += 400) {
        const batch = db.batch();
        excess.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      totalPurged += excess.length;
      console.log(`[purge] ${store} capped: removed ${excess.length}`);
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