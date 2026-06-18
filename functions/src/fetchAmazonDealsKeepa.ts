import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { db } from "./firebaseAdmin";

// 🔐 Firebase Secret
const KEEPA_KEY = defineSecret("KEEPA_API_KEY");

export const fetchAmazonDealsKeepa = onSchedule(
  {
    schedule: "every 6 hours",
    secrets: [KEEPA_KEY],
  },
  async () => {
    console.log("KEEPA FUNCTION STARTED");

    const keepaKey = KEEPA_KEY.value();
    if (!keepaKey) {
      console.log("KEEPA KEY MISSING");
      return;
    }

    // 🔥 STEP 1: Pull REAL Amazon ASINs dynamically (not hard-coded)
    const snap = await db
      .collection("deals_online")
      .where("source", "==", "amazon")
      .orderBy("timestamp", "desc")
      .limit(25)
      .get();

    const ASINS = snap.docs
      .map((d) => d.data().asin)
      .filter((asin) => typeof asin === "string");

    if (ASINS.length === 0) {
      console.log("NO AMAZON ASINS FOUND");
      return;
    }

    console.log("ASINS SENT TO KEEPA:", ASINS.length);

    // 🔥 STEP 2: Call Keepa with REAL ASINs
    const url = `https://api.keepa.com/product?key=${keepaKey}&domain=1&stats=180&buybox=1&asin=${ASINS.join(
      ","
    )}`;

    let res;
    try {
      res = await axios.get(url, { timeout: 15000 });
    } catch (e: any) {
      console.log(
        "KEEPA AXIOS ERROR:",
        e?.response?.status,
        e?.response?.data
      );
      return;
    }

    const products = res.data?.products || [];
    console.log("KEEPA PRODUCTS COUNT:", products.length);

    if (products.length === 0) return;

    const batch = db.batch();

    // 🔥 STEP 3: Save ONLY REAL PRICED DEALS
    products.forEach((p: any) => {
      if (!p?.asin) return;

      const priceCents =
        p.stats?.buyBoxPrice ??
        p.stats?.current?.[1] ??
        p.stats?.current?.[0];

      if (!priceCents || priceCents <= 0) return;

      const price = priceCents / 100;

      const listPriceCents = p.stats?.avg90?.[0];
      const listPrice =
        listPriceCents && listPriceCents > 0
          ? listPriceCents / 100
          : null;

      const discountPercent =
        listPrice && listPrice > price
          ? Math.round(((listPrice - price) / listPrice) * 100)
          : null;

      // Floor: skip Amazon deals under 25% off (or with no provable discount)
      if (discountPercent === null || discountPercent < 25) {
        return;
      }

      batch.set(
        db.collection("deals_online").doc(`AMZ_${p.asin}`),
        {
          id: `AMZ_${p.asin}`,
          asin: p.asin,
          title: p.title || "Amazon Deal",
          price,
          listPrice,
          discountPercent,
          store: "Amazon",
          image: p.imagesCSV
            ? `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
            : null,
          url: `https://www.amazon.com/dp/${p.asin}?tag=flashradar20-20`,
          source: "amazon",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("KEEPA DEALS UPDATED");
  }
);
