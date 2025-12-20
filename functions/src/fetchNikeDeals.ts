import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Nike public product feed (no auth)
 * Pulls sale/discounted items
 */
export const fetchNikeDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://api.nike.com/cic/browse/v2?queryid=products&anonymousId=flashradar&country=US&language=en&count=24&filter=marketplace(US)&filter=productInfo.merchPrice.discounted(true)";

    const res = await axios.get(url, {
      headers: {
        "User-Agent": "FlashRadar/1.0",
      },
    });

    const products = res.data?.data?.products || [];
    const batch = db.batch();

    products.forEach((p: any) => {
      const price = p.price?.currentPrice;
      if (!price) return;

      const id = `NIKE_${p.id}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: p.title || "Nike Item",
          price,
          store: "Nike",
          image: p.images?.portraitURL || null,
          url: `https://www.nike.com/t/${p.slug}`,
          source: "nike",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("👟 Nike deals saved:", products.length);
  }
);
//
//  fetchNikeDeals.ts
//  
//
//  Created by Miguel Cz on 12/16/25.
//

