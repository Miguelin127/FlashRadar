import { onRequest } from "firebase-functions/v2/https";

export const detectSoldPrice = onRequest(async (req, res) => {
  try {
    const { prices } = req.body;

    if (!Array.isArray(prices) || prices.length === 0) {
      res.status(400).json({ error: "No prices provided" });
      return;
    }

    // naive “sold price” heuristic (median)
    const sorted = prices.map(Number).filter(Boolean).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const soldPrice =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];

    res.json({ soldPrice });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
