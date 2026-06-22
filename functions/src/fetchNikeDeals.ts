import { onSchedule } from "firebase-functions/v2/scheduler";
import axios from "axios";
import { db } from "./firebaseAdmin";
import { isBlockedContent } from "./contentFilter";

export const fetchNikeDeals = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    const url =
      "https://api.nike.com/cic/browse/v2?queryid=products&anonymousId=flashradar&country=US&language=en&count=48&filter=marketplace(US)&filter=productInfo.merchPrice.discounted(true)";

    const res = await axios.get(url, {
      headers: { "User-Agent": "FlashRader/1.0" },
    });

    const products = res.data?.data?.products?.products ?? [];
    let added = 0;
    let skipped = 0;

    for (const p of products) {
      const currentPrice = p.price?.currentPrice;
      const fullPrice = p.price?.fullPrice;
      if (!currentPrice || !fullPrice) continue;

      const discountPercent = Math.round(((fullPrice - currentPrice) / fullPrice) * 100);
      if (discountPercent < 35) { skipped++; continue; }

      const imageUrl = p.images?.portraitURL || p.images?.squarishURL || null;
      if (!imageUrl) { skipped++; continue; }

      // Use product ID as key — prevents duplicates on re-ingest
      const id = `nike_${p.id}`;
      const ref = db.collection("deals_live").doc(id);
      const existing = await ref.get();

      // Skip if exists with same price
      if (existing.exists && existing.data()?.price === currentPrice) {
        skipped++;
        continue;
      }

      if (isBlockedContent(p.title)) continue;

      await ref.set({
        id,
        title: p.title || "Nike Item",
        price: currentPrice,
        originalPrice: fullPrice,
        discountPercent,
        store: "Nike",
        storeKey: "nike",
        imageUrl,
        url: `https://www.nike.com/t/${p.slug}`,
        source: "nike",
        hot: discountPercent >= 40,
        rare: discountPercent >= 50,
        live: true,
        createdAt: existing.exists
          ? existing.data()?.createdAt
          : new Date(),
        updatedAt: new Date(),
      }, { merge: true });

      added++;
    }

    console.log(`👟 Nike: added=${added}, skipped=${skipped}`);
  }
);