import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RAPID_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPID_HOST = "realtime-walmart-data.p.rapidapi.com";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_KEY ?? "AIzaSyBeldwLWhSlf0bYzJHBmtce4R1XoEnXBXc";

const SEARCH_CITIES = [
  { name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Houston", lat: 29.7604, lng: -95.3698 },
  { name: "Phoenix", lat: 33.4484, lng: -112.0740 },
  { name: "Dallas", lat: 32.7767, lng: -96.7970 },
  { name: "Miami", lat: 25.7617, lng: -80.1918 },
  { name: "New York", lat: 40.7128, lng: -74.0060 },
  { name: "Atlanta", lat: 33.7490, lng: -84.3880 },
  { name: "Seattle", lat: 47.6062, lng: -122.3321 },
  { name: "Denver", lat: 39.7392, lng: -104.9903 },
];

function parsePrice(v?: string): number | null {
  if (!v || v === "Not available") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

async function getNearbyWalmarts(lat: number, lng: number): Promise<any[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: "Walmart Supercenter",
        maxResultCount: 3,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 20000.0,
          },
        },
      }),
    });
    const data: any = await res.json();
    return data.places ?? [];
  } catch {
    return [];
  }
}

export const fetchInstoreDeals = onRequest(
  { timeoutSeconds: 300, memory: "512MiB" },
  async (_req, res) => {
    if (!RAPID_KEY) {
      res.json({ error: "RAPIDAPI_KEY not set" });
      return;
    }

    const headers = {
      "x-rapidapi-key": RAPID_KEY,
      "x-rapidapi-host": RAPID_HOST,
    };

    const [rollbackRes, clearanceRes] = await Promise.all([
      fetch(`https://${RAPID_HOST}/rollbacks?page=1`, { headers }),
      fetch(`https://${RAPID_HOST}/search?query=clearance&page=1`, { headers }),
    ]);

    const rollbackJson: any = await rollbackRes.json();
    const clearanceJson: any = await clearanceRes.json();

    const allItems = [
      ...(rollbackJson.results ?? []),
      ...(clearanceJson.results ?? []),
    ];

    const deepDeals = allItems.filter(item => {
      const price = parsePrice(item.price);
      const originalPrice = parsePrice(item.originalPrice) ?? parsePrice(item.wasPrice);
      if (!price || !originalPrice || originalPrice <= price) return false;
      const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
      return discount >= 75;
    });

    console.log(`[InstoreDeals] Found ${deepDeals.length} deals at 75%+ off`);

    if (deepDeals.length === 0) {
      res.json({ success: true, written: 0, message: "No deals at 75%+ off" });
      return;
    }

    const allStores: any[] = [];
    for (const city of SEARCH_CITIES) {
      const stores = await getNearbyWalmarts(city.lat, city.lng);
      allStores.push(...stores);
    }

    const seenStores = new Set<string>();
    const uniqueStores = allStores.filter(s => {
      if (seenStores.has(s.id)) return false;
      seenStores.add(s.id);
      return true;
    });

    console.log(`[InstoreDeals] Found ${uniqueStores.length} Walmart stores`);

    if (uniqueStores.length === 0) {
      res.json({ success: true, written: 0, message: "No stores found" });
      return;
    }

    let written = 0;
    for (const deal of deepDeals.slice(0, 20)) {
      const price = parsePrice(deal.price);
      const originalPrice = parsePrice(deal.originalPrice) ?? parsePrice(deal.wasPrice);
      if (!price || !originalPrice) continue;
      const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
      const imageUrl = deal.image ?? deal.Image ?? null;
      if (!imageUrl) continue;

      const store = uniqueStores[written % uniqueStores.length];
      const id = `instore_walmart_${deal.usItemId ?? deal.id}_${store.id}`;

      await db.collection("deals_instore").doc(id).set({
        id,
        title: deal.name ?? deal.title ?? "Walmart Clearance Deal",
        price,
        originalPrice,
        discountPercent,
        store: store.displayName?.text ?? "Walmart",
        storeKey: "walmart",
        storeAddress: store.formattedAddress ?? "",
        latitude: store.location.latitude,
        longitude: store.location.longitude,
        imageUrl,
        url: `https://www.walmart.com${deal.canonicalUrl ?? ""}`,
        source: "walmart_instore",
        hot: true,
        rare: discountPercent >= 85,
        lightning: discountPercent >= 90,
        live: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      written++;
    }

    console.log(`[InstoreDeals] Written ${written} in-store deals`);
    res.json({ success: true, written });
  }
);