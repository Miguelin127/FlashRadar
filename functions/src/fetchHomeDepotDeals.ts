import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";

/**
 * Home Depot public product feed (sale items)
 * Safe A-method (used by HD frontend)
 */
export const fetchHomeDepotDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://www.homedepot.com/federation-gateway/graphql?operationName=searchModel";

    const payload = {
      operationName: "searchModel",
      variables: {
        keyword: "clearance",
        storeId: "1801",
        channel: "DESKTOP",
        pageSize: 24,
      },
      query: `
        query searchModel($keyword: String!, $storeId: String!, $channel: String!, $pageSize: Int!) {
          searchModel(
            keyword: $keyword
            storeId: $storeId
            channel: $channel
            pageSize: $pageSize
          ) {
            products {
              productId
              identifiers {
                productLabel
              }
              pricing {
                value
                original
              }
              media {
                images {
                  url
                }
              }
              itemId
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

    const products = res.data?.data?.searchModel?.products || [];
    const batch = db.batch();

    products.forEach((p: any) => {
      const price = p.pricing?.value;
      const original = p.pricing?.original;

      if (!price || !original || price >= original) return;

      const id = `HD_${p.productId}`;
      const ref = db.collection("deals_online").doc(id);

      batch.set(
        ref,
        {
          id,
          title: p.identifiers?.productLabel || "Home Depot Item",
          price,
          listPrice: original,
          discountPercent: Math.round(
            ((original - price) / original) * 100
          ),
          store: "Home Depot",
          image: p.media?.images?.[0]?.url || null,
          url: `https://www.homedepot.com/p/${p.productId}`,
          source: "home_depot",
          timestamp: Date.now(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    console.log("🏠 Home Depot deals saved:", products.length);
  }
);

