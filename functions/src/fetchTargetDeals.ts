// functions/src/fetchTargetDeals.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Target public product search (no auth)
 * Pulls discounted items
 */
export const fetchTargetDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2" +
      "?key=9f36aeafbe6076c8c7b3c1b2b7f0c7e2" +
      "&category=5xt1a" + // deals / clearance
      "&channel=WEB" +
      "&count=24" +
      "&offset=0" +
      "&pricing_store_id=3991";

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "FlashRadar/1.0",
      },
    });

    const products =
      res.data?.data?.search?.products || [];

    const batch = db.batch();

    products.forEach((p: any) => {
      const price = p.price?.current_retail;
      const list = p.price?.reg_retail;

      if (!price || !list || price >= list) return;

      const id = `TARGET_${p.tcin}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: p.item?.product_description?.title || "Target Item",
          price,
          listPrice: list,
          discountPercent: Math.round(((list - price) / list) * 100),
          store: "Target",
          image: p.item?.enrichment?.images?.primary_image_url || null,
          url: `https://www.target.com/p/-/A-${p.tcin}`,
          source: "target",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("🎯 Target deals saved:", products.length);
  }
);

