import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import cheerio from "cheerio";

admin.initializeApp();
const db = admin.firestore();

export const scheduledDealIngest = onSchedule(
  "every 30 minutes",
  async () => {
    console.log("🔥 Slickdeals ingest started");

    const deals = [
      "https://slickdeals.net/f/19141945", // example
    ];

    for (const slickUrl of deals) {
      try {
        const res = await fetch(slickUrl, {
          headers: {
            "user-agent": "Mozilla/5.0 FlashRadarBot",
          },
        });

        const html = await res.text();
        const $ = cheerio.load(html);

        const title = $("h1").first().text().trim();
        if (!title) continue;

        // 🔗 outbound merchant link
        const outbound =
          $('a[href*="amazon"], a[href*="walmart"], a[href*="target"]')
            .first()
            .attr("href") || null;

        if (!outbound) continue;

        // 🔥 FETCH STORE PAGE (REAL IMAGE)
        const storeRes = await fetch(outbound, {
          headers: {
            "user-agent": "Mozilla/5.0 FlashRadarBot",
          },
        });

        const storeHtml = await storeRes.text();
        const $$ = cheerio.load(storeHtml);

        // ✅ REAL product image
        const image =
          $$('meta[property="og:image"]').attr("content") || null;

        const store =
          outbound.includes("amazon")
            ? "amazon"
            : outbound.includes("walmart")
            ? "walmart"
            : outbound.includes("target")
            ? "target"
            : "unknown";

        const id = Buffer.from(slickUrl).toString("base64");

        await db.collection("deals_online").doc(id).set(
          {
            id,
            title,
            store,
            url: outbound,
            image,
            source: "slickdeals",
            imageBroken: !image,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("✅ Saved:", title);
      } catch (e) {
        console.error("❌ Failed ingest:", e);
      }
    }

    console.log("✅ Slickdeals ingest complete");
  }
);
