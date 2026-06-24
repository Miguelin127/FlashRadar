import { onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import * as cheerio from "cheerio";
import { isBlockedContent } from "./contentFilter";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const BLOCKED_DOMAINS = [
  "slickdeals.net",
  "dealnews.com",
  "reddit.com",
  "forum"
];

const ALLOWED_DOMAINS = [
  "amazon.com",
  "walmart.com",
  "target.com",
  "nike.com",
  "puma.com",
  "sephora.com",
  "homedepot.com",
  "bestbuy.com",
  "apple.com",
  "ebay.com",
  "sjv.io"
];

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

/* =========================
   🔥 PURE ENRICHMENT LOGIC
   ========================= */

export async function runEnrichment(dealId: string) {

  const dealRef = db.collection("deals_online").doc(dealId);
  const dealSnap = await dealRef.get();

  if (!dealSnap.exists) return;

  const deal = dealSnap.data()!;
  const url: string | undefined = deal.merchantUrl || deal.url;

  if (!url) {
    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "missing_url"
    });
    return;
  }

  const domain = extractDomain(url);

  // API-sourced deals (Impact catalogs) already have complete, trusted data
  // from the catalog API. Their `url` is an affiliate redirect (sjv.io), NOT a
  // scrapeable product page — so skip HTML scraping and mark enriched directly,
  // preserving the clean title/price/image/discount we already have.
  if (deal.source === "impact") {
    await dealRef.set({
      enrichmentStatus: "enriched",
      imageUrl: deal.image || deal.imageUrl || null,
      canonicalUrl: deal.url,
      storeKey: deal.storeKey || "bestchoice",
      authorityScore: 100,
      lastValidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      blockedReason: admin.firestore.FieldValue.delete(),
    }, { merge: true });
    return;
  }

  if (!domain) {
    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "invalid_url"
    });
    return;
  }

  /* Walmart must be product page */
  if (domain.includes("walmart.com") && !url.includes("/ip/")) {
    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "not_product_page"
    });
    return;
  }

  if (BLOCKED_DOMAINS.some(d => domain.includes(d))) {
    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "aggregator_blocked"
    });
    return;
  }

  /* handle ebay first — block under 50% discount */
  if (domain.includes("ebay.com")) {
    const discountPercent = deal.discountPercent ?? 0;
    if (discountPercent < 50) {
      await dealRef.update({
        enrichmentStatus: "flagged",
        blockedReason: "ebay_low_discount"
      });
      return;
    }
    if (isBlockedContent(deal.title)) {
      await dealRef.update({
        enrichmentStatus: "flagged",
        blockedReason: "adult_content"
      });
      return;
    }
    await dealRef.set({
      store: "ebay.com",
      storeKey: "ebay",
      canonicalUrl: url,
      enrichmentStatus: "enriched",
      lastValidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      blockedReason: admin.firestore.FieldValue.delete()
    }, { merge: true });
    return;
  }

  /* whitelist check */
  if (!ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith("." + d))) {
    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "non_whitelisted_domain"
    });
    return;
  }

  try {

    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(response.data);

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('img').first().attr("src");

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text();

    const priceText =
      $('[class*="price"]').first().text() || "";

    const parsedPrice = parseFloat(priceText.replace(/[^\d.]/g, ""));

    const genericStoreKey = domain.split(".")[0];
    const FLOORS: Record<string, number> = {
      amazon: 25, walmart: 25, nike: 35, target: 25, homedepot: 25,
    };
    const genericDiscount = deal.discountPercent ?? 0;
    const genericFloor = FLOORS[genericStoreKey] ?? 25;
    if (genericDiscount < genericFloor) {
      await dealRef.update({
        enrichmentStatus: "flagged",
        blockedReason: `${genericStoreKey}_low_discount`
      });
      return;
    }

    if (isBlockedContent(title) || isBlockedContent(deal.title)) {
      await dealRef.update({
        enrichmentStatus: "flagged",
        blockedReason: "adult_content"
      });
      return;
    }

    await dealRef.set({
      title,
      imageUrl: image || deal.imageUrl || deal.image,
      price: parsedPrice ?? deal.price,
      store: domain,
      storeKey: genericStoreKey,
      canonicalUrl: url,
      authorityScore: 100,
      enrichmentStatus: "enriched",
      lastValidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      blockedReason: admin.firestore.FieldValue.delete()
    }, { merge: true });

  } catch (err) {

    await dealRef.update({
      enrichmentStatus: "flagged",
      blockedReason: "scrape_failed"
    });

  }
}

/* =========================
   Callable Wrapper
   ========================= */

export const enrichDealV3 = onCall(async (request) => {

  const { dealId } = request.data;

  if (!dealId) {
    throw new Error("dealId required");
  }

  await runEnrichment(dealId);

  return { success: true };

});