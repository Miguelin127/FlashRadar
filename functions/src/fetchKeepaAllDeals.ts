import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import axios from "axios";
import { db } from "./firebaseAdmin";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

const DOMAIN = 1;
const OUT_COL = "deals_online";
const ASIN_COL = "keepa_asin_pool";

const TIMEOUT = 30000;
const BATCH_SIZE = 50;

// Keepa price indexes
const AMAZON_PRICE = 100;
const NEW_PRICE = 1;

/* ───────── HELPERS ───────── */

function amazonUrl(asin: string) {
  return `https://www.amazon.com/dp/${asin}`;
}

function centsToDollars(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n) / 100;
}

function firstValidPrice(arr?: unknown[]): number | null {
  if (!Array.isArray(arr)) return null;
  for (const v of arr) {
    const price = centsToDollars(v);
    if (price !== null) return price;
  }
  return null;
}

/* ───────── KEEPA FETCH ───────── */

async function fetchProducts(key: string, asins: string[]) {
  const res = await axios.get("https://api.keepa.com/product", {
    params: {
      key,
      domain: DOMAIN,
      asin: asins.join(","),
      priceTypes: `${AMAZON_PRICE},${NEW_PRICE}`,
      stats: 180,
      buybox: 1,
      offers: 20,
    },
    timeout: TIMEOUT,
  });

  return Array.isArray(res.data?.products) ? res.data.products : [];
}

/* ───────── UPSERT ───────── */

async function upsertProducts(
  products: any[],
  asinDocs: Map<string, FirebaseFirestore.DocumentSnapshot>
): Promise<void> {
  const writes: Promise<any>[] = [];
  const now = new Date();

  for (const p of products) {
    if (!p?.asin || !p.stats) continue;

    const asinSnap = asinDocs.get(p.asin);
    const currentFailCount = asinSnap?.get("failCount") ?? 0;

    const price =
      centsToDollars(p.buyBoxPrice) ??
      centsToDollars(p.deal?.price) ??
      firstValidPrice(p.stats.current);

    const listPrice =
      firstValidPrice(p.stats.avg90) ??
      firstValidPrice(p.stats.avg180);

    // ❌ FAILED SCAN
    if (!price || !listPrice || listPrice <= price) {
      writes.push(
        db.collection(ASIN_COL).doc(p.asin).set(
          { failCount: currentFailCount + 1 },
          { merge: true }
        )
      );
      continue;
    }

    const discountPercent = Math.round(
      ((listPrice - price) / listPrice) * 100
    );

    if (discountPercent < 20) {
      writes.push(
        db.collection(ASIN_COL).doc(p.asin).set(
          { failCount: currentFailCount + 1 },
          { merge: true }
        )
      );
      continue;
    }

    // ✅ SUCCESS
    writes.push(
      db.collection(ASIN_COL).doc(p.asin).set(
        {
          failCount: 0,
          lastGoodDealAt: now,
        },
        { merge: true }
      )
    );

    writes.push(
      db.collection(OUT_COL).doc(`AMZ_${p.asin}`).set(
        {
          id: `AMZ_${p.asin}`,
          asin: p.asin,
          title: p.title ?? "Amazon Deal",
          store: "Amazon",
          source: "online",
          online: true,

          price,
          listPrice,
          discountPercent,

          url: amazonUrl(p.asin),
          image: p.imagesCSV
            ? `https://images-na.ssl-images-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
            : null,

          lightning: p.deal?.isLightningDeal === true,
          rare: discountPercent >= 70,
          hot: price <= 10,

          timestamp: Date.now(),
          updatedAt: Date.now(),
        },
        { merge: true }
      )
    );
  }

  if (writes.length) {
    await Promise.all(writes);
    logger.info(`💾 Wrote ${writes.length} updates`);
  } else {
    logger.info("ℹ️ No qualifying deals this run");
  }
}

/* ───────── SCHEDULED JOB ───────── */

export const fetchKeepaAllDeals = onSchedule(
  {
    schedule: "every 5 minutes",
    secrets: [KEEPA_KEY],
    region: "us-central1",
  },
  async () => {
    logger.info("⚡ KEEPA DEAL SCAN START");

    const key = KEEPA_KEY.value();
    if (!key) {
      logger.error("❌ Missing KEEPA_KEY");
      return;
    }

    const snap = await db
      .collection(ASIN_COL)
      .where("failCount", "<", 10)
      .orderBy("failCount", "asc")
      .orderBy("lastScannedAt", "asc")
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) {
      logger.warn("⚠️ No ASINs found");
      return;
    }

    const asinDocs = new Map(
      snap.docs.map((d) => [d.data().asin, d])
    );

    const asins = snap.docs
      .map((d) => d.data().asin)
      .filter((a): a is string => Boolean(a));

    const now = new Date();

    await Promise.all(
      snap.docs.map((d) =>
        d.ref.set({ lastScannedAt: now }, { merge: true })
      )
    );

    const products = await fetchProducts(key, asins);

    await upsertProducts(products, asinDocs);

    logger.info(`✅ DONE — scanned ${products.length} products`);
  }
);
