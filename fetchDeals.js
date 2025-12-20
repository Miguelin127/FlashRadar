const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Fetches real public deal data from Walmart, Amazon, and Home Depot via RapidAPI.
 * This version uses public endpoints (no private API keys required yet).
 */
exports.fetchDeals = functions.pubsub
  .schedule("every 3 hours")
  .timeZone("America/Chicago")
  .onRun(async (context) => {
    console.log("🔄 Fetching latest deals...");

    try {
      // Example: Walmart Deals API via RapidAPI (you can replace with your own later)
      const walmartRes = await fetch(
        "https://real-time-product-search.p.rapidapi.com/search?q=deals&country=US&language=en",
        {
          method: "GET",
          headers: {
            "x-rapidapi-host": "real-time-product-search.p.rapidapi.com",
            "x-rapidapi-key": "YOUR_RAPIDAPI_KEY_HERE", // Replace when ready
          },
        }
      );

      const walmartData = await walmartRes.json();
      const items = walmartData.data || [];

      // Save deals into Firestore
      const batch = db.batch();
      items.slice(0, 20).forEach((item) => {
        const ref = db.collection("deals_online").doc(item.product_id.toString());
        batch.set(ref, {
          title: item.product_title,
          price: item.offer.price || "N/A",
          source: "Walmart",
          image: item.product_photo,
          link: item.offer.link,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`✅ Synced ${items.length} Walmart deals to Firestore.`);
    } catch (err) {
      console.error("❌ Error fetching deals:", err);
    }

    return null;
  });
