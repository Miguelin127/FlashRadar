import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./firebaseAdmin";
import { parseStringPromise } from "xml2js";

// 🔁 Runs every 60 minutes
export const scheduledDealIngest = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "America/Chicago",
  },
  async () => {
    const FEED_URL =
      "https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1";

    // ✅ Native fetch (Node 20)
    const res = await fetch(FEED_URL);
    const xml = await res.text();

    const parsed = await parseStringPromise(xml);
    const items = parsed.rss.channel[0].item.slice(0, 15);

    for (const item of items) {
      const title = item.title[0];
      const link = item.link[0];

      const priceMatch = title.match(/\$(\d+(\.\d{1,2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1]) : null;

      const dedupeKey = `slickdeals::${link.split("/f/")[1]?.split("?")[0]}`;
      if (!dedupeKey) continue;

      const docRef = db.collection("deals_online").doc(dedupeKey);
      if ((await docRef.get()).exists) continue;

      await docRef.set({
        id: dedupeKey,
        title,
        price,
        store: "unknown",
        source: "slickdeals",
        url: link,
        createdAt: new Date(),
        hot: price !== null && price < 10,
        rare: false,
        flashLevel: "LOW",
      });
    }

    console.log("✅ Scheduled ingestion complete");
  }
);
