// functions/scripts/ingestAmazonDeals.js
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "flashradar-71c93",
});

const db = admin.firestore();

const KEEPA_KEY = process.env.KEEPA_API_KEY;
if (!KEEPA_KEY) {
  console.error("❌ Missing KEEPA_API_KEY");
  process.exit(1);
}

/* ───────── IMAGE ───────── */

function asinToImage(asin) {
  return asin
    ? `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.LZZZZZZZ.jpg`
    : null;
}

/* ───────── RUN ───────── */

async function run() {
  console.log("🚀 Fetching Amazon deals from Keepa (Deal API)");

  const selection = {
    page: 0,
    domainId: 1,
    priceTypes: [1],
    deltaPercentRange: [40, 2147483647],
    currentRange: [8800, 2147483647],
    minRating: 30,
    singleVariation: true,
    sortType: 1,
  };

  const res = await axios.get("https://api.keepa.com/deal", {
    params: {
      key: KEEPA_KEY,
      selection: JSON.stringify(selection),
    },
  });

  // ✅ SAFE EXTRACTION
  const deals = Array.isArray(res.data?.deals?.dr)
    ? res.data.deals.dr
    : [];

  console.log(`→ Received ${deals.length} Amazon deals`);

  if (deals.length === 0) {
    console.log("⚠️ No deals returned");
    console.log(JSON.stringify(res.data, null, 2));
    return;
  }

  let saved = 0;

  for (const d of deals) {
    if (!d?.asin) continue;

    // ✅ Keepa price = d.current[1] (Amazon new price)
    const amazonPriceCents =
      Array.isArray(d.current) && typeof d.current[1] === "number"
        ? d.current[1]
        : null;

    // ❌ Skip free / invalid prices
    if (!amazonPriceCents || amazonPriceCents <= 0) continue;

    const id = `amazon_${d.asin}`;

    await db.collection("deals_online_amazon").doc(id).set(
      {
        id,
        asin: d.asin,
        title: d.title || "Amazon Deal",

        store: "amazon",
        storeKey: "amazon",
        tier: "premium",

        price: amazonPriceCents / 100,

        url: `https://www.amazon.com/dp/${d.asin}`,
        image: asinToImage(d.asin),
        imageUrl: asinToImage(d.asin),

        live: true,
        source: "keepa",

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    saved++;
  }

  console.log(`✅ Saved ${saved} Amazon deals`);
}

run().catch((err) => {
  console.error("❌ Amazon ingest failed:", err.response?.data || err);
  process.exit(1);
});
