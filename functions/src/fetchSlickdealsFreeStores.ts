import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const FEEDS = [
  { store: "walmart", q: "walmart" },
  { store: "homedepot", q: "home%20depot" },
  { store: "target", q: "target" },
];

function parsePrice(title: string) {
  const m = title.match(/\$[\d,.]+/g);
  if (!m?.length) return null;
  return Number(m[m.length - 1].replace(/[$,]/g, ""));
}

export const fetchSlickdealsFreeStores = onRequest(
  { region: "us-central1" },
  async (_req, res) => {
    let added = 0;
    const parser = new XMLParser({ ignoreAttributes: false });

    for (const f of FEEDS) {
      const url = `https://slickdeals.net/newsearch.php?q=${f.q}&searcharea=deals&searchin=first&rss=1`;
      const feed = await axios.get(url, { timeout: 15000 });
      const parsed = parser.parse(feed.data);
      const items = parsed?.rss?.channel?.item || [];
      const list = Array.isArray(items) ? items : [items];

      for (const it of list) {
        const title = it?.title;
        const link = it?.link;
        if (!title || !link) continue;

        const price = parsePrice(title);
        if (!price) continue;

        const clean = title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
        const id = `${f.store}_${clean}_${price}`;

        const ref = db.collection("deals_online").doc(id);
        if ((await ref.get()).exists) continue;

        await ref.set({
          id,
          title,
          price,
          store: f.store,
          source: "slickdeals",
          url: link,
          live: true,
          hot: price <= 10,
          rare: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        added++;
      }
    }

    res.json({ success: true, added });
  }
);
