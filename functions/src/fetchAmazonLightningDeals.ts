// FlashRadarProject/FlashRadar/functions/src/fetchAmazonLightningDeals.ts

import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { db } from "./firebaseAdmin";

const KEEPA_KEY = defineSecret("KEEPA_KEY");

export const fetchAmazonLightningDeals = onSchedule(
  {
    schedule: "every 1 hours",
    secrets: [KEEPA_KEY],
  },
  async () => {
    console.log("⚡ KEEP A LIGHTNING FETCH START");

    const keepaKey = KEEPA_KEY.value();
    if (!keepaKey) return;

    const ASINS = [
      "B089KV4YYX",
      "B08N5WRWNW",
      "B09G3HRP9M",
      "B0C5YF3C5K",
    ];

    const url =
      `https://api.keepa.com/product` +
      `?key=${keepaKey}` +
      `&domain=1` +
      `&stats=180` +          // 🔴 REQUIRED
      `&offers=20` +          // 🔴 REQUIRED
      `&buybox=1` +
      `&asin=${ASINS.join(",")}`;

    const res = await axios.get(url);
    const products = res.data?.products || [];

    console.log("KEEPA PRODUCTS:", products.length);

    const batch = db.batch();

    for (const p of products) {
      if (!p?.asin) continue;

      const priceCents =
        p.stats?.buyBoxPrice ??
        p.stats?.current?.[1] ??
        p.stats?.current?.[0];

      if (!priceCents || priceCents <= 0) continue;

      const image =
        p.imagesCSV?.length
          ? `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
          : null;

      batch.set(
        db.collection("deals_online").doc(`AMZ_LIGHT_${p.asin}`),
        {
          id: `AMZ_LIGHT_${p.asin}`,
          asin: p.asin,
          title: "⚡ Amazon Lightning Deal",
          price: priceCents / 100,
          store: "Amazon",
          source: "online",
          lightning: true,
          image,
          url: `https://www.amazon.com/dp/${p.asin}?tag=flashradar20e-20`,
          timestamp: Date.now(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    console.log("⚡ LIGHTNING DEALS WRITTEN");
  }
);
