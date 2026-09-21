import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const db = admin.firestore();

export const serveDealPage = functions.https.onRequest(async (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");

  const dealId = req.path.split("/deal/")[1]?.split("/")[0];

  if (!dealId) {
    res.status(404).send("<html><head><title>Deal not found</title></head><body>Deal not found</body></html>");
  }

  try {
    const dealDoc = await db.collection("deals_online").doc(dealId).get();

    if (!dealDoc.exists) {
      res.status(404).send("<html><head><title>Deal not found</title></head><body>Deal not found</body></html>");
    }

    const deal = dealDoc.data();
    const title = deal?.title || "FlashRadar Deal";
    const price = deal?.price ? `$${deal.price.toFixed(2)}` : "";
    const discount = deal?.discountPercent ? `${deal.discountPercent}% OFF` : "";
    const store = deal?.store || "Unknown Store";
    const image = deal?.imageUrl || deal?.image || "https://flashradarapp.com/og-image.png";
    const description = `${title} - ${price} ${discount} at ${store}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="https://flashradarapp.com/deal/${dealId}" />
  <meta property="og:type" content="website" />
  
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  
  <script>window.location.href = 'https://flashradarapp.com/deal/${dealId}';</script>
</head>
<body>
  <p>Redirecting to FlashRadar...</p>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error("Error serving deal page:", error);
    res.status(500).send("<html><head><title>Error</title></head><body>Error loading deal</body></html>");
  }
});
