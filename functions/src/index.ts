// functions/src/index.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

// 👇 FORCE LOAD HTTP PROXY (GEN-2 REQUIREMENT)
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
// DEAL INGESTION
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
export { expireAmazonDeals } from "./expireAmazonDeals";
export { expireLightningDeals } from "./expireLightningDeals";
export { notifyLightningEndingSoon } from "./notifyLightningEndingSoon";
export { purgeExpiredDeals } from "./purgeExpiredDeals";
export { purgeDeadAsins } from "./purgeDeadAsins";
export { bridgeDealsOnlineToDeals } from "./bridgeDealsOnlineToDeals";
export { walmartRunNow } from "./walmartRunNow";
export { scheduledDealIngest } from "./scheduledIngest";
export { refreshBrokenImages } from "./refreshBrokenImages";
export { watchDealUrlChanges } from "./watchDealUrlChanges";
export { getPrintfulProducts } from "./getPrintfulProducts";
export { enrichDealV3 } from "./enrichDealV3";
export { autoEnrichDeal } from "./autoEnrichDeal";
export { fetchSlickdealsFreeStores } from "./fetchSlickdealsFreeStores";

export const slickdealsCron = onSchedule("every 10 minutes", async () => {
  await fetch(
    "https://us-central1-flashradar-71c93.cloudfunctions.net/fetchSlickdealsFreeStores"
  );
});
// ─────────────────────────────────────────────
// WALMART AUTO-RUN CRON (GEN-2)
// ─────────────────────────────────────────────
export const walmartCron = onSchedule("every 30 minutes", async () => {
  await fetch(
    "https://us-central1-flashradar-71c93.cloudfunctions.net/walmartRunNow"
  );
});

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

// ─────────────────────────────────────────────
// LINK PREVIEW
// ─────────────────────────────────────────────
export { previewDealV2 } from "./previewDeal";

// ─────────────────────────────────────────────
// PRINTFUL CONNECTION TEST (OAuth 2.0)
// ─────────────────────────────────────────────
export const testPrintfulConnection = onRequest(async (req, res) => {
  try {
    const response = await fetch("https://api.printful.com/product-templates", {
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      },
    });

    const data = await response.json();

    res.status(200).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

