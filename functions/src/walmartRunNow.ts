import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function isHot(price: number) {
  return price < 10;
}

function isRare(price: number, original?: number | null) {
  if (!original) return false;
  return ((original - price) / original) * 100 >= 90;
}

export const walmartRunNow = onRequest(async (_req, res) => {
  try {
    const FEED_URL =
      "https://slickdeals.net/newsearch.php?q=walmart&searcharea=deals&searchin=first&rss=1";

    // ⬇️ FETCH RAW XML
    const feed = await axios.get(FEED_URL, { responseType: "text" });

    // ⬇️ PARSE XML
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(feed.data);

    const items =
      parsed?.rss?.channel?.item ||
      parsed?.feed?.entry ||
      [];

    let added = 0;

    for (const item of items) {
      const title: string = item.title;
      if (!title) continue;

      const prices = title.match(/\$[\d.]+/g);
      if (!prices) continue;

      const price = Number(prices[prices.length - 1].replace("$", ""));
      const originalPrice =
        prices.length > 1 ? Number(prices[0].replace("$", "")) : null;

      if (!price || Number.isNaN(price)) continue;

      const clean = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const docId = `walmart_${clean.slice(0, 50)}_${price}`;

      const ref = db.collection("deals_online_walmart").doc(docId);
      if ((await ref.get()).exists) continue;

      await ref.set({
        id: docId,
        title,
        price,
        originalPrice,
        image: item.enclosure?.link || "",
        url: item.link,
        category: "general",
        hot: isHot(price),
        rare: isRare(price, originalPrice),
        source: "slickdeals_walmart",
        store: "walmart",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      added++;
    }

    res.status(200).json({ success: true, added });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
