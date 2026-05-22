// functions/src/scheduledIngest.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";
import * as admin from "firebase-admin";
import { parseStringPromise } from "xml2js";

const AFFILIATE_TAG = "flashradar20-20";

const BLOCKED_KEYWORDS = [
  "gift card", "kindle", "ebook", "audiobook", "magazine",
  "digital download", "prime video", "movie rental",
];

const FEEDS = [
  "https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1",
  "https://slickdeals.net/newsearch.php?q=walmart&searcharea=deals&searchin=first&rss=1",
  "https://slickdeals.net/newsearch.php?q=target&searcharea=deals&searchin=first&rss=1",
  "https://slickdeals.net/newsearch.php?q=best%20buy&searcharea=deals&searchin=first&rss=1",
  "https://slickdeals.net/newsearch.php?q=home%20depot&searcharea=deals&searchin=first&rss=1",
];

function detectStore(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("amazon")) return "amazon";
  if (u.includes("walmart")) return "walmart";
  if (u.includes("target")) return "target";
  if (u.includes("bestbuy") || u.includes("best buy")) return "bestbuy";
  if (u.includes("homedepot") || u.includes("home depot")) return "homedepot";
  if (u.includes("costco")) return "costco";
  if (u.includes("lowes")) return "lowes";
  if (u.includes("samsclub")) return "samsclub";
  return "online";
}

function buildAffiliateUrl(url: string, store: string): string {
  try {
    if (store === "amazon") {
      const asin = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1];
      if (asin) return `https://www.amazon.com/dp/${asin}?tag=${AFFILIATE_TAG}`;
      const u = new URL(url);
      u.searchParams.set("tag", AFFILIATE_TAG);
      return u.toString();
    }
    if (store === "walmart") {
      const pid = process.env.WALMART_PUBLISHER_ID ?? "";
      return `https://goto.walmart.com/c/${pid}/576484/9383?subId1=flashradar&u=${encodeURIComponent(url)}`;
    }
    if (store === "target") {
      const pid = process.env.TARGET_PUBLISHER_ID ?? "";
      return `https://goto.target.com/c/${pid}/81938/2092?subId1=flashradar&u=${encodeURIComponent(url)}`;
    }
    if (store === "bestbuy") {
      const pid = process.env.BESTBUY_PUBLISHER_ID ?? "";
      return `https://goto.bestbuy.com/c/${pid}/56504/10741?subId1=flashradar&u=${encodeURIComponent(url)}`;
    }
    return url;
  } catch { return url; }
}

function parsePrice(title: string): number | null {
  const matches = title.match(/\$[\d,]+\.?\d*/g);
  if (!matches?.length) return null;
  return Math.min(...matches.map((m) => parseFloat(m.replace(/[$,]/g, ""))));
}

function parseOriginalPrice(title: string): number | null {
  const matches = title.match(/\$[\d,]+\.?\d*/g);
  if (!matches || matches.length < 2) return null;
  return Math.max(...matches.map((m) => parseFloat(m.replace(/[$,]/g, ""))));
}

export const scheduledDealIngest = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "America/Chicago",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    let added = 0;
    let skipped = 0;

    for (const feedUrl of FEEDS) {
      try {
        const res = await fetch(feedUrl);
        const xml = await res.text();
        const parsed = await parseStringPromise(xml);
        const items = parsed?.rss?.channel?.[0]?.item?.slice(0, 20) ?? [];

        for (const item of items) {
          const title: string = item.title?.[0] ?? "";
          const link: string = item.link?.[0] ?? "";

          if (!title || !link) { skipped++; continue; }

          // Block low-value categories
          const tl = title.toLowerCase();
          if (BLOCKED_KEYWORDS.some((kw) => tl.includes(kw))) {
            skipped++; continue;
          }

          const price = parsePrice(title);
          if (!price || price < 10) { skipped++; continue; }

          const originalPrice = parseOriginalPrice(title);
          const discountPercent = originalPrice && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : null;

          // Detect store from URL
          const store = detectStore(link);
          const affiliateUrl = buildAffiliateUrl(link, store);

          // Dedup key
          const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 50);
          const dedupeKey = `SD_${store}_${cleanTitle}_${price}`;

          const docRef = db.collection("deals_online").doc(dedupeKey);
          if ((await docRef.get()).exists) { skipped++; continue; }

          await docRef.set({
            id: dedupeKey,
            title,
            price,
            originalPrice: originalPrice ?? null,
            discountPercent: discountPercent ?? null,
            store,
            storeKey: store,
            source: "slickdeals",
            // Both URL fields — app uses affiliateUrl first
            affiliateUrl,
            merchantUrl: link,
            url: affiliateUrl,
            live: true,
            isActive: true,
            hot: (discountPercent ?? 0) >= 30,
            rare: (discountPercent ?? 0) >= 60,
            enrichmentStatus: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          added++;
        }
      } catch (err) {
        console.error(`[scheduledIngest] Feed error ${feedUrl}:`, err);
      }
    }

    console.log(`[scheduledIngest] Done — added: ${added}, skipped: ${skipped}`);
  }
);