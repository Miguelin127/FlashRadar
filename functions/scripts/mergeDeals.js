// functions/scripts/mergeDeals.js
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "flashradar-71c93",
});

const db = admin.firestore();

/* ───────────────── CONFIG ───────────────── */

const SOURCE_COLLECTIONS = [
  "deals_online_walmart",
  "deals_online_target",
  "deals_online_homedepot",
  "deals_online_amazon",
];

const FREE_STORE_KEYS = new Set(["walmart", "target", "homedepot"]);

/* ───────────────── HELPERS ───────────────── */

function normalizeStoreKey(store = "") {
  return String(store)
    .toLowerCase()
    .replace(".com", "")
    .replace(/[^a-z0-9]/g, "");
}

function tierForStore(storeKey) {
  return FREE_STORE_KEYS.has(storeKey) ? "free" : "premium";
}

function resolveImage(data = {}) {
  const raw =
    data.image_https ||
    data.imageUrl ||
    data.primaryImageUrl ||
    data.primaryImage ||
    data.thumbnail ||
    data.image ||
    null;

  if (typeof raw !== "string") return null;
  return raw.replace(/^http:\/\//i, "https://");
}

/**
 * ✅ WALMART IMAGE FALLBACK
 * Walmart images are deterministic by product ID
 */
function imageFromWalmartUrl(url) {
  if (!url) return null;
  const match = url.match(/\/ip\/.*?\/(\d+)/);
  if (!match) return null;
  return `https://i5.walmartimages.com/asr/${match[1]}.jpg`;
}

/**
 * ✅ DISCOUNT % FROM BEST HISTORICAL PRICE
 */
function computeDiscountPercent(data = {}) {
  const price = typeof data.price === "number" ? data.price : null;
  if (!price || price <= 0) return null;

  const candidates = [
    data.originalPrice,
    data.avg30,
    data.avg60,
    data.avg90,
  ].filter((p) => typeof p === "number" && p > price);

  if (!candidates.length) return null;

  const oldPrice = Math.max(...candidates);
  const percent = Math.round(((oldPrice - price) / oldPrice) * 100);

  return percent > 0 ? percent : null;
}

/* ───────────────── RUN ───────────────── */

async function run() {
  console.log("🚀 Starting merge into /deals_online");

  let total = 0;

  for (const col of SOURCE_COLLECTIONS) {
    const snap = await db.collection(col).get();
    console.log(`→ ${col}: ${snap.size} docs`);

    for (const d of snap.docs) {
      const data = d.data() || {};

      // ❌ Skip invalid price
      if (typeof data.price !== "number" || data.price <= 0) continue;

      const store = data.store || col.replace("deals_online_", "");
      const storeKey = normalizeStoreKey(store);
      const tier = data.tier || tierForStore(storeKey);

      // ✅ IMAGE FIX (with Walmart fallback)
      const image =
        resolveImage(data) ||
        (storeKey === "walmart" ? imageFromWalmartUrl(data.url) : null) ||
        null;

      const discountPercent = computeDiscountPercent(data);

      await db.collection("deals_online").doc(d.id).set(
        {
          ...data,

          // normalized
          store,
          storeKey,
          tier,

          // images
          image,
          imageUrl: image,

          // pricing
          discountPercent,

          createdAt:
            data.createdAt ||
            admin.firestore.FieldValue.serverTimestamp(),

          sourceCollection: col,
        },
        { merge: true }
      );

      total++;
    }
  }

  console.log(`✅ DONE — merged ${total} deals into /deals_online`);
}

run().catch((err) => {
  console.error("❌ MERGE FAILED:", err);
  process.exit(1);
});
