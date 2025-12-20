// functions/src/fetchWalmartDeals.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Walmart public search feed
 * Pulls rollback / sale items
 */
export const fetchWalmartDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://www.walmart.com/search/api/presets/rollback?count=24&page=1";

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "FlashRadar/1.0",
        Accept: "application/json",
      },
    });

    const items = res.data?.items || [];
    const batch = db.batch();

    items.forEach((item: any) => {
      const price = item.priceInfo?.currentPrice?.price;
      if (!price) return;

      const id = `WMT_${item.usItemId}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: item.name || "Walmart Item",
          price,
          store: "Walmart",
          image: item.imageInfo?.thumbnailUrl || null,
          url: `https://www.walmart.com/ip/${item.usItemId}`,
          source: "walmart",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("🛒 Walmart deals saved:", items.length);
  }
);

