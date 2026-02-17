// functions/src/runAmazonLightning.ts

import axios from "axios";
import * as admin from "firebase-admin";
import { db } from "../firebaseAdmin";

export async function runAmazonLightning(keepaKey: string) {
  console.log("⚡ RUN AMAZON LIGHTNING CORE");

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
    `&stats=180` +
    `&offers=20` +
    `&buybox=1` +
    `&asin=${ASINS.join(",")}`;

  const res = await axios.get(url);
  const products = res.data?.products || [];

  console.log("📦 KEEPA PRODUCTS:", products.length);

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const p of products) {
    if (!p?.asin) continue;

    const currentCents =
      p.stats?.buyBoxPrice ??
      p.stats?.current?.[1] ??
      p.stats?.current?.[0];

    if (!currentCents || currentCents <= 0) continue;

    const originalCents =
      p.stats?.avg?.[1] ??
      p.stats?.avg90?.[1] ??
      null;

    const price = currentCents / 100;
    const originalPrice =
      originalCents && originalCents > currentCents
        ? originalCents / 100
        : null;

    const discountPercent =
      originalPrice
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : null;

    const image =
      p.imagesCSV?.length
        ? `https://m.media-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
        : null;

    const docId = `AMZ_LIGHT_${p.asin}`;

    batch.set(
      db.collection("deals_online").doc(docId),
      {
        id: docId,
        asin: p.asin,
        title: p.title || "Amazon Lightning Deal",
        price,
        originalPrice,
        discountPercent,
        store: "Amazon",
        source: "online",
        hot: discountPercent !== null && discountPercent >= 40,
        rare: discountPercent !== null && discountPercent >= 70,
        live: true,
        image,
        url: `https://www.amazon.com/dp/${p.asin}?tag=flashradar20e-20`,
        updatedAt: now,
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log("✅ AMAZON LIGHTNING DEALS UPSERTED");
}
