import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/* ───────────────────── CONFIG ───────────────────── */

const MAX_IMAGE_RETRIES = 5;
const RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/* ───────────────────── HELPERS ───────────────────── */

function extractImageFromHtml(html: string): string | null {
  const $ = cheerio.load(html);

  // Common product image selectors
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'img[itemprop="image"]',
    'img[src*="product"]',
    'img[src*="main"]',
  ];

  for (const sel of selectors) {
    const el = $(sel).first();
    const src =
      el.attr("content") ||
      el.attr("src");

    if (src && src.startsWith("http")) {
      return src;
    }
  }

  return null;
}

/* ───────────────────── FUNCTION ───────────────────── */

export const refreshBrokenImages = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Chicago",
  },
  async () => {
    console.log("🖼️ Starting broken image refresh job");

    const now = Date.now();

    const snapshot = await db
      .collection("deals_online")
      .where("imageBroken", "==", true)
      .where("imagePermanentlyDisabled", "!=", true)
      .limit(50)
      .get();

    if (snapshot.empty) {
      console.log("✅ No broken images to refresh");
      return;
    }

    for (const docSnap of snapshot.docs) {
      const deal = docSnap.data();
      const dealId = docSnap.id;

      const retryCount = deal.imageRetryCount || 0;
      const lastChecked = deal.imageCheckedAt || 0;

      // ⏳ Cooldown
      if (now - lastChecked < RETRY_COOLDOWN_MS) {
        continue;
      }

      // 🚫 Max retries reached
      if (retryCount >= MAX_IMAGE_RETRIES) {
        await docSnap.ref.set(
          {
            imagePermanentlyDisabled: true,
            imageBroken: true,
            imageDisabledAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(`🚫 Permanently disabled image: ${dealId}`);
        continue;
      }

      const targetUrl =
        deal.affiliateUrl ||
        deal.merchantUrl ||
        deal.url;

      if (!targetUrl) {
        await docSnap.ref.set(
          {
            imageRetryCount: retryCount + 1,
            imageCheckedAt: now,
          },
          { merge: true }
        );
        continue;
      }

      try {
        const res = await fetch(targetUrl, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; FlashRadarBot/1.0)",
          },
          redirect: "follow",
        });

        const html = await res.text();
        const newImage = extractImageFromHtml(html);

        if (!newImage) {
          await docSnap.ref.set(
            {
              imageRetryCount: retryCount + 1,
              imageCheckedAt: now,
            },
            { merge: true }
          );

          console.log(`❌ No image found (${retryCount + 1}) → ${dealId}`);
          continue;
        }

        // ✅ SUCCESS
        await docSnap.ref.set(
          {
            image: newImage,
            imageBroken: false,
            imageRetryCount: 0,
            imagePermanentlyDisabled: false,
            imageRecoveredAt:
              admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(`✅ Image recovered: ${dealId}`);
      } catch (err) {
        console.error(`⚠️ Refresh failed: ${dealId}`, err);

        await docSnap.ref.set(
          {
            imageRetryCount: retryCount + 1,
            imageCheckedAt: now,
          },
          { merge: true }
        );
      }
    }

    console.log("🧹 Broken image refresh job complete");
  }
);
