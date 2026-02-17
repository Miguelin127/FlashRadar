import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* ───────── HELPERS ───────── */

function isHot(price: number) {
  return price < 10;
}

function isRare(price: number, original?: number | null) {
  if (!original) return false;
  return ((original - price) / original) * 100 >= 90;
}

/**
 * Resolve Slickdeals → final whmerchant URL
 */
async function resolveMerchantUrl(slickUrl: string): Promise<string | null> {
  try {
    const res = await axios.get(slickUrl, {
      maxRedirects: 0,
      validateStatus: (s) => s === 301 || s === 302,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    return res.headers.location || null;
  } catch (err: any) {
    return err?.response?.headers?.location || null;
  }
}

/**
 * 🔥 Walmart API enrichment (RapidAPI)
 */
async function fetchWalmartByTitle(title: string) {
  try {
    const res = await axios.get(
      "https://realtime-walmart-data.p.rapidapi.com/search",
      {
        params: {
          query: title,
          page: 1,
          sort: "best_match",
        },
        headers: {
          "X-RapidAPI-Key": process.env.RAPIDAPI_KEY!,
          "X-RapidAPI-Host": "realtime-walmart-data.p.rapidapi.com",
        },
        timeout: 15000,
      }
    );

    return res.data?.results?.[0] ?? null;
  } catch {
    return null;
  }
}

/* ───────── FUNCTION ───────── */

export const fetchWalmartDealsSlick = onRequest(
  { region: "us-central1" },
  async (_req, res) => {
    try {
      const FEED_URL =
        "https://slickdeals.net/newsearch.php?q=walmart&searcharea=deals&searchin=first&rss=1";

      const feed = await axios.get(FEED_URL, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 15000,
      });

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(feed.data);

      const rawItems = parsed?.rss?.channel?.item;
      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems
        ? [rawItems]
        : [];

      let added = 0;

      for (const item of items) {
        const title: string = item?.title;
        const slickUrl: string = item?.link;
        if (!title || !slickUrl) continue;

        const prices = title.match(/\$[\d.]+/g);
        if (!prices?.length) continue;

        let price = Number(prices.at(-1)?.replace("$", ""));
        let originalPrice =
          prices.length > 1 ? Number(prices[0].replace("$", "")) : null;

        if (!price || Number.isNaN(price)) continue;

        const clean = title.toLowerCase().replace(/[^a-z0-9]/g, "");
        const docId = `walmart_${clean.slice(0, 50)}_${price}`;

        const ref = db.collection("deals_online").doc(docId);
        if ((await ref.get()).exists) continue;

        const merchantUrl = await resolveMerchantUrl(slickUrl);
        if (!merchantUrl || !merchantUrl.includes("walmart.com")) continue;

        // 🔥 ENRICH VIA WALMART API
        const walmart = await fetchWalmartByTitle(title);
        if (!walmart?.image) continue;

        const image = walmart?.image

        if (walmart?.price) {
          price = Number(walmart.price.replace("$", ""));
        }

        if (
          walmart?.originalPrice &&
          walmart.originalPrice !== "Not available"
        ) {
          originalPrice = Number(
            walmart.originalPrice.replace("$", "")
          );
        }

        await ref.set({
          id: docId,
          title,
          price,
          originalPrice,
          image, // ✅ THIS IS WHAT YOUR APP RENDERS
          url: walmart?.canonicalUrl ?? merchantUrl,
          merchantUrl,

          category: "general",
          hot: isHot(price),
          rare: isRare(price, originalPrice),
          source: "walmart_api",
          store: "walmart",
          live: true,

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        added++;
      }

      res.status(200).json({ success: true, added });
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: "Fetch failed" });
    }
  }
);
