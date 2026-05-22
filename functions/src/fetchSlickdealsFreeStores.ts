import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Resolve Slickdeals redirect → actual store URL
 */
async function resolveSlickdealsUrl(url: string) {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 15000,
      validateStatus: () => true,
    });

    return res.request?.res?.responseUrl || url;
  } catch (err) {
    console.error("Redirect resolve failed:", err);
    return url;
  }
}

/**
 * Detect store from final URL
 */
function detectStore(url: string) {
  const u = url.toLowerCase();

  if (u.includes("amazon")) return "amazon";
  if (u.includes("walmart")) return "walmart";
  if (u.includes("target")) return "target";
  if (u.includes("bestbuy")) return "bestbuy";
  if (u.includes("homedepot")) return "homedepot";
  if (u.includes("costco")) return "costco";
  if (u.includes("newegg")) return "newegg";
  if (u.includes("lenovo")) return "lenovo";

  return "unknown";
}

const FEEDS = [
  { store: "frontpage", url: "https://slickdeals.net/newsearch.php?searcharea=deals&searchin=first&rss=1" },
  { store: "amazon", url: "https://slickdeals.net/newsearch.php?q=amazon&searcharea=deals&searchin=first&rss=1" },
  { store: "walmart", url: "https://slickdeals.net/newsearch.php?q=walmart&searcharea=deals&searchin=first&rss=1" },
  { store: "target", url: "https://slickdeals.net/newsearch.php?q=target&searcharea=deals&searchin=first&rss=1" },
  { store: "bestbuy", url: "https://slickdeals.net/newsearch.php?q=best%20buy&searcharea=deals&searchin=first&rss=1" },
  { store: "homedepot", url: "https://slickdeals.net/newsearch.php?q=home%20depot&searcharea=deals&searchin=first&rss=1" },
  { store: "costco", url: "https://slickdeals.net/newsearch.php?q=costco&searcharea=deals&searchin=first&rss=1" },
  { store: "newegg", url: "https://slickdeals.net/newsearch.php?q=newegg&searcharea=deals&searchin=first&rss=1" },
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
      const url = f.url;

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

        // Remove junk cheap deals
        if (price < 10) continue;

        // Remove junk cheap deals
        if (price < 10) continue;

        // Remove obvious junk deals
        const t = title.toLowerCase();
        if (t.includes("gift card") || t.includes("magazine")) continue;

        // Resolve Slickdeals redirect → store
        const finalUrl = await resolveSlickdealsUrl(link);

        // Detect store from final URL
        const detectedStore = detectStore(finalUrl);

        const clean = title
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 60);

        const id = `${detectedStore}_${clean}_${price}`;

        const ref = db.collection("deals_online").doc(id);

        if ((await ref.get()).exists) continue;

        await ref.set({
          id,
          title,
          price,
          store: detectedStore,
          storeKey: detectedStore,
          source: "slickdeals",
          url: finalUrl,
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