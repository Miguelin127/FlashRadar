import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

export const previewDealV2 = onRequest(async (req, res) => {
  try {
    // 🔥 READ RAW URL STRING (GEN-2 SAFE)
    const raw = req.url ?? "";

    // Look for imageProxy=1 anywhere
    if (raw.includes("imageProxy=1")) {
      const match = raw.match(/url=([^&]+)/);

      if (!match) {
        res.status(400).send("Missing url");
        return;
      }

      const imageUrl = decodeURIComponent(match[1]);

      if (!imageUrl.startsWith("http")) {
        res.status(400).send("Invalid image url");
        return;
      }

      const response = await fetch(imageUrl, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Host: "m.media-amazon.com",
        },
      });

      if (!response.ok) {
        res.status(502).send("Fetch failed");
        return;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const type =
        response.headers.get("content-type") ?? "image/jpeg";

      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.status(200).send(buffer);
      return;
    }

    // fallback
    res.status(400).send("Invalid mode");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal error");
  }
});
