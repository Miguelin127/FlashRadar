import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import axios from "axios";

/**
 * Lightweight HTTP resolver
 * Safe for Cloud Run (no import-time execution)
 */
export const resolveTitle = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (req, res) => {
    try {
      // ✅ Works in:
      // - firebase functions:shell
      // - HTTPS calls
      // - Cloud Run
      const data: any = req.body ?? req.query ?? {};
      const url: string | undefined = data.url;

      if (!url) {
        res.status(400).send("Missing url");
        return;
      }

      // 🔒 Safe fetch (no headers, no redirects forced)
      const response = await axios.get(url, {
  timeout: 8000,
  validateStatus: () => true,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
});


      const html = response.data;
      const match = html?.match(/<title>(.*?)<\/title>/i);
      const resolvedTitle = match?.[1]?.trim() || null;

      res.json({ title: resolvedTitle });
    } catch (err) {
      logger.error("resolveTitle error", err);
      res.status(500).json({ error: "Failed to resolve title" });
    }
  }
);
