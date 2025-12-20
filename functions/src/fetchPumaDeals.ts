import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Puma sale feed (no auth)
 * Uses public product listing with sale filter
 */
export const fetchPumaDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://us.puma.com/api/graphql";

    const payload = {
      query: `
        query SaleProducts {
          products(
            filter: { price: { sale: true } }
            pageSize: 24
            currentPage: 1
          ) {
            items {
              sku
              name
              url_key
              image {
                url
              }
              price_range {
                minimum_price {
                  final_price {
                    value
                  }
                }
              }
            }
          }
        }
      `,
    };

    const res = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "FlashRadar/1.0",
      },
    });

    const items = res.data?.data?.products?.items || [];
    const batch = db.batch();

    items.forEach((item: any) => {
      const price = item.price_range?.minimum_price?.final_price?.value;
      if (!price) return;

      const id = `PUMA_${item.sku}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: item.name || "Puma Item",
          price,
          store: "Puma",
          image: item.image?.url || null,
          url: `https://us.puma.com/${item.url_key}.html`,
          source: "puma",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("🐆 Puma deals saved:", items.length);
  }
);
//
//  fetchPumaDeals.ts
//  
//
//  Created by Miguel Cz on 12/16/25.
//

