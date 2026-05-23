// functions/src/index.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

import "./imageProxy";

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

// Nike + Puma + Sephora — every 4 hours (brand sales don't change fast)
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

// Enrichment worker — every 5 min (processes pending deals)
export { enrichDealsWorker } from "./enrichDealsWorker";

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