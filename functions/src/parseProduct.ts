import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

export const parseProduct = onRequest(async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FlashRadarBot/1.0; +https://flashradarapp.web.app)",
        Accept: "text/html",
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // ─────────────────────────────
    // TITLE RESOLUTION
    // ─────────────────────────────
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='title']").attr("content") ||
      $("title").first().text().trim() ||
      null;

    // ─────────────────────────────
    // PRICE RESOLUTION (GENERIC)
    // ─────────────────────────────
    const genericPriceText =
      $("meta[property='product:price:amount']").attr("content") ||
      $('[itemprop="price"]').attr("content") ||
      $('[class*="price"]').first().text();

    // ─────────────────────────────
    // AMAZON FALLBACK SELECTORS
    // (will work on SOME SKUs, not all)
    // ─────────────────────────────
    const amazonPriceText =
      $("#priceblock_ourprice").text() ||
      $("#priceblock_dealprice").text() ||
      $("#price_inside_buybox").text() ||
      $('[data-a-color="price"]').first().text();

    const finalPriceText = genericPriceText || amazonPriceText || null;

    const price = finalPriceText
      ? Number(finalPriceText.replace(/[^0-9.]/g, ""))
      : null;

    // ─────────────────────────────
    // VALIDATION
    // ─────────────────────────────
    if (!title || !price || Number.isNaN(price)) {
      res.status(422).json({
        error: "Unable to extract product data",
        debug: {
          titleFound: Boolean(title),
          priceFound: Boolean(price),
          site: new URL(url).hostname,
        },
      });
      return;
    }

    // ─────────────────────────────
    // SUCCESS
    // ─────────────────────────────
    res.status(200).json({
      title,
      price,
      site: new URL(url).hostname,
    });
    return;
  } catch (err) {
    console.error("parseProduct error:", err);
    res.status(500).json({ error: "Server error" });
    return;
  }
});
