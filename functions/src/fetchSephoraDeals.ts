import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Sephora public sale feed (no auth)
 * Pulls sale / clearance items
 */
export const fetchSephoraDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://www.sephora.com/api/v3/catalog/products?currentPage=1&pageSize=24&sortBy=PRICE_LOW_TO_HIGH&includeRegionsMap=true&content=true&filters=sale:true";

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "FlashRadar/1.0",
        Accept: "application/json",
      },
    });

    const products = res.data?.products || [];
    const batch = db.batch();

    products.forEach((p: any) => {
      const salePrice = p.currentSku?.listPrice;
      if (!salePrice) return;

      const id = `SEPHORA_${p.productId}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: p.displayName || "Sephora Item",
          price: salePrice,
          store: "Sephora",
          image: p.heroImage || null,
          url: `https://www.sephora.com/product/${p.slug}`,
          source: "sephora",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("💄 Sephora deals saved:", products.length);
  }
);

