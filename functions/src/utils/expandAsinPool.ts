import { db } from "../firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

const POOL = "keepa_asin_pool";

export async function expandAsinPool(
  products: any[],
  discoveredFrom: string
) {
  const writes: Promise<any>[] = [];

  for (const p of products) {
    if (!p?.asin) continue;

    // 1️⃣ Variations (parent/child ASINs)
    if (Array.isArray(p.variations)) {
      for (const asin of p.variations) {
        writes.push(
          db.collection(POOL).doc(asin).set(
            {
              asin,
              source: "keepa",
              discoveredFrom,
              createdAt: Timestamp.now(),
            },
            { merge: true }
          )
        );
      }
    }

    // 2️⃣ Frequently bundled / related
    if (Array.isArray(p.frequentlyBoughtTogether)) {
      for (const asin of p.frequentlyBoughtTogether) {
        writes.push(
          db.collection(POOL).doc(asin).set(
            {
              asin,
              source: "keepa",
              discoveredFrom,
              createdAt: Timestamp.now(),
            },
            { merge: true }
          )
        );
      }
    }
  }

  if (writes.length) {
    await Promise.all(writes);
  }
}
