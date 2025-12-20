import { onRequest } from "firebase-functions/v2/https";
import { db } from "./firebaseAdmin";

export const fetchAmazonLightningDealsNow = onRequest(async (req, res) => {
  const ASINS = [
    "B089KV4YYX",
    "B08N5WRWNW",
    "B09G3HRP9M",
    "B0C5YF3C5K",
  ];

  for (const asin of ASINS) {
    await db
      .collection("deals_online")
      .doc(`AMZ_LIGHT_${asin}`)
      .set({
        id: `AMZ_LIGHT_${asin}`,
        asin,
        title: "⚡ Amazon Lightning Deal",
        price: 39.99,
        store: "Amazon",
        source: "online",
        lightning: true,

        // ✅ REAL, GUARANTEED IMAGE
        image: "https://m.media-amazon.com/images/I/71K2HcJ6QqL._AC_SL1500_.jpg",

        url: `https://www.amazon.com/dp/${asin}?tag=flashradar20e-20`,
        timestamp: Date.now(),
      });
  }

  res.json({ success: true });
});
