// functions/src/fetchBestBuyDeals.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Best Buy public deals feed (no API key)
 * Pulls sale / clearance items
 */
export const fetchBestBuyDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://www.bestbuy.com/api/tcfb/model.json?paths=%5B%5B%22shop%22,%22browse%22,%22deals%22%5D%5D&method=get";

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "FlashRadar/1.0",
        Accept: "application/json",
      },
    });

    const items =
      res.data?.jsonGraph?.shop?.browse?.deals?.items || [];

    const batch = db.batch();

    items.forEach((item: any) => {
      const sku = item?.sku;
      const price = item?.price?.current;

      if (!sku || !price) return;

      const id = `BBY_${sku}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: item?.name || "Best Buy Item",
          price,
          store: "Best Buy",
          image: item?.image || null,
          url: `https://www.bestbuy.com/site/${sku}.p`,
          source: "bestbuy",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("🟦 Best Buy deals saved:", items.length);
  }
);

