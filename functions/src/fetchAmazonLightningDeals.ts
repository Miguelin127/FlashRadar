import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import axios from "axios";
import { db } from "./firebaseAdmin";
import { SEED_ASINS } from "./utils/seedAsins";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

const DOMAIN = 1;
const OUT_COL = "deals_online";
const TIMEOUT = 30000;
const BUYBOX = 3;

/* ───────── HELPERS ───────── */

function amazonUrl(asin: string) {
  return `https://www.amazon.com/dp/${asin}`;
}

function centsToDollars(v: any): number {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round((n / 100) * 100) / 100;
}

function computeTags(discount: number, price: number, now: Date) {
  const ageMs = Date.now() - now.getTime();
  return {
    hot: price > 0 && price <= 10,
    rare: discount >= 90,
    live: ageMs <= 10 * 60 * 1000,
  };
}

/* ───────── FETCH LIGHTNING ASINS ───────── */

async function fetchLightningAsins(key: string): Promise<string[]> {
  try {
    const res = await axios.get("https://api.keepa.com/deal", {
      params: {
        key,
        domain: DOMAIN,
        page: 0,
        selection: JSON.stringify({}),
      },
      timeout: TIMEOUT,
    });

    const rows = Array.isArray(res.data?.dr) ? res.data.dr : [];
    return rows.map((r: any) => r.asin).filter(Boolean);
  } catch {
    return [];
  }
}

/* ───────── FETCH PRODUCTS ───────── */

async function fetchProducts(key: string, asins: string[]) {
  const res = await axios.get("https://api.keepa.com/product", {
    params: {
      key,
      domain: DOMAIN,
      asin: asins.join(","),
      stats: 180,
      buybox: 1,
    },
    timeout: TIMEOUT,
  });

  return Array.isArray(res.data?.products) ? res.data.products : [];
}

/* ───────── UPSERT ───────── */

async function upsertProducts(products: any[]) {
  const writes: Promise<any>[] = [];
  const now = new Date();

  for (const p of products) {
    if (!p?.asin || !p?.stats?.current || !p?.stats?.avg90) continue;

    const current = centsToDollars(
      p.stats.current?.[BUYBOX] ?? p.stats.current?.[0]
    );

    const avg90 = centsToDollars(
      p.stats.avg90?.[BUYBOX] ?? p.stats.avg90?.[0]
    );

    if (!current || !avg90 || avg90 <= current) continue;

    const discount = Math.round(((avg90 - current) / avg90) * 100);
    if (discount < 25 || discount > 95) continue;

    const tags = computeTags(discount, current, now);

    writes.push(
      db.collection(OUT_COL).doc(p.asin).set(
        {
          title: p.title ?? "Amazon Deal",
          store: "Amazon",
          platform: "amazon",
          isOnline: true,
          price: current,
          url: amazonUrl(p.asin),
          image: p.imagesCSV
            ? `https://images-na.ssl-images-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
            : null,
          discountPercent: discount,

          hot: tags.hot,
          rare: tags.rare,
          live: tags.live,

          source: "online",
          timestamp: now,
          updatedAt: now,
        },
        { merge: true }
      )
    );
  }

  if (writes.length) await Promise.all(writes);
}

/* ───────── SCHEDULED FAILSAFE ───────── */

export const fetchAmazonLightningDeals = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [KEEPA_KEY],
    region: "us-central1",
  },
  async () => {
    logger.info("⚡ FAILSAFE AMAZON DEAL SCAN START");

    const key = KEEPA_KEY.value();
    if (!key) return;

    // 1️⃣ Try Lightning Deals
    const lightningAsins = await fetchLightningAsins(key);

    // 2️⃣ Fallback to Seed ASINs if Lightning is empty
    const sourceAsins =
      lightningAsins.length >= 5 ? lightningAsins : SEED_ASINS;

    let scanned = 0;

    for (let i = 0; i < sourceAsins.length; i += 50) {
      const batch = sourceAsins.slice(i, i + 50);
      const products = await fetchProducts(key, batch);
      await upsertProducts(products);
      scanned += products.length;
    }

    logger.info(`✅ DONE — scanned ${scanned} products (failsafe active)`);
  }
);
