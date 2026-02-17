// flashradar/functions/src/imageProxy.ts

import { onRequest } from "firebase-functions/v2/https";
import fetch from "node-fetch";

export const imageProxy = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  async (req, res) => {
    try {
      const imageUrl = req.query.url as string;

      if (!imageUrl || !imageUrl.startsWith("http")) {
        res.status(400).send("Invalid image URL");
        return;
      }

      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1",
          Accept: "image/*,*/*;q=0.8",
          Referer: imageUrl,
        },
      });

      if (!response.ok) {
        res.status(404).send("Image fetch failed");
        return;
      }

      const buffer = await response.buffer();
      const contentType =
        response.headers.get("content-type") || "image/jpeg";

      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (err) {
      console.error("imageProxy error:", err);
      res.status(500).send("Proxy error");
    }
  }
);
