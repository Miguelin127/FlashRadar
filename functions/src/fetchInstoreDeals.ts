// functions/src/fetchInstoreDeals.ts

import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import fetch from "node-fetch";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RAPID_KEY = process.env.RAPIDAPI_KEY ?? "";
const RAPID_HOST = "realtime-walmart-data.p.rapidapi.com";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_KEY ?? "AIzaSyBeldwLWhSlf0bYzJHBmtce4R1XoEnXBXc";

const SEARCH_CITIES = [
  { name: "Chicago",     lat: 41.8781,  lng: -87.6298  },
  { name: "Los Angeles", lat: 34.0522,  lng: -118.2437 },
  { name: "Houston",     lat: 29.7604,  lng: -95.3698  },
  { name: "Phoenix",     lat: 33.4484,  lng: -112.0740 },
  { name: "Dallas",      lat: 32.7767,  lng: -96.7970  },
  { name: "Miami",       lat: 25.7617,  lng: -80.1918  },
  { name: "New York",    lat: 40.7128,  lng: -74.0060  },
  { name: "Atlanta",     lat: 33.7490,  lng: -84.3880  },
  { name: "Seattle",     lat: 47.6062,  lng: -122.3321 },
  { name: "Denver",      lat: 39.7392,  lng: -104.9903 },
];

// Store chains to seed on the map
const STORE_CHAINS = [
  { query: "Walmart Supercenter", key: "walmart",   label: "Walmart"    },
  { query: "Target",              key: "target",    label: "Target"     },
  { query: "Home Depot",          key: "homedepot", label: "Home Depot" },
  { query: "Best Buy",            key: "bestbuy",   label: "Best Buy"   },
  { query: "Costco Wholesale",    key: "costco",    label: "Costco"     },
];

function parsePrice(v?: string | number): number | null {
  if (v === undefined || v === null || v === "Not available") return null;
  if (typeof v === "number") return isFinite(v) && v > 0 ? v : null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? n : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getNearbyStores(
  lat: number,
  lng: number,
  query: string
): Promise<any[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: query,
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

// Fetch deals from deals_live for a given storeKey
async function getDealsForStore(storeKey: string): Promise<any[]> {
  const snap = await db.collection("deals_live")
    .where("storeKey", "==", storeKey)
    .where("live", "==", true)
    .limit(30)
    .get();
  return snap.docs.map((d) => d.data());
}

// Fetch Walmart rollback deals from RapidAPI
async function fetchWalmartDeals(): Promise<any[]> {
  const headers = {
    "x-rapidapi-key": RAPID_KEY,
    "x-rapidapi-host": RAPID_HOST,
  };

  const KEYWORDS = [
    "clearance", "deals", "kitchen", "home", "toys",
    "furniture", "appliances", "tools", "bedding", "clothing",
  ];
  const allItems: any[] = [];
  const seenIds = new Set<string>();
  for (const kw of KEYWORDS) {
    try {
      const res = await fetch(
        `https://${RAPID_HOST}/search?keyword=${encodeURIComponent(kw)}`,
        { headers }
      );
      if (res.status !== 200) { await sleep(300); continue; }
      const json: any = await res.json();
      const results = json.results ?? [];
      for (const it of results) {
        const id = it.id ?? it.usItemId;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          allItems.push(it);
        }
      }
    } catch (e) {
      console.warn(`[InstoreDeals] search failed for "${kw}":`, e);
    }
    await sleep(300);
  }
  console.log(`[InstoreDeals] Walmart raw items collected (deduped): ${allItems.length}`);

  return allItems.filter((item) => {
    const price = parsePrice(item.price);
    const originalPrice = parsePrice(item.originalPrice) ?? parsePrice(item.wasPrice);
    if (!price || !originalPrice || originalPrice <= price) return false;
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);
    return discount >= 30;
  });
}

export const fetchInstoreDeals = onRequest(
  { timeoutSeconds: 540, memory: "1GiB" },
  async (_req, res) => {
    if (!RAPID_KEY) {
      res.json({ error: "RAPIDAPI_KEY not set" });
      return;
    }

    console.log("[InstoreDeals] Starting multi-store ingest...");

    // ── 1. Fetch Walmart deals from RapidAPI ────────────────────
    const walmartDeals = await fetchWalmartDeals();
    console.log(`[InstoreDeals] Walmart API deals: ${walmartDeals.length}`);

    // ── 2. Fetch deals_live deals for non-Walmart stores ────────
    const [targetDeals, homeDepotDeals, bestBuyDeals, costcoDeals] = await Promise.all([
      getDealsForStore("target"),
      getDealsForStore("homedepot"),
      getDealsForStore("bestbuy"),
      getDealsForStore("costco"),
    ]);

    console.log(`[InstoreDeals] deals_live — Target: ${targetDeals.length}, HomeDepot: ${homeDepotDeals.length}, BestBuy: ${bestBuyDeals.length}, Costco: ${costcoDeals.length}`);

    // Map storeKey → deals pool
    const dealsByStore: Record<string, any[]> = {
      walmart:   walmartDeals,
      target:    targetDeals,
      homedepot: homeDepotDeals,
      bestbuy:   bestBuyDeals,
      costco:    costcoDeals,
    };

    // ── 3. Collect store locations ───────────────────────────────
    const storeLocations: Record<string, any[]> = {};
    for (const chain of STORE_CHAINS) {
      storeLocations[chain.key] = [];
    }

    for (const city of SEARCH_CITIES) {
      for (const chain of STORE_CHAINS) {
        const places = await getNearbyStores(city.lat, city.lng, chain.query);
        storeLocations[chain.key].push(...places);
        await sleep(100); // stay under Places API rate limit
      }
    }

    // Dedupe store locations
    for (const chain of STORE_CHAINS) {
      const seen = new Set<string>();
      storeLocations[chain.key] = storeLocations[chain.key].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      console.log(`[InstoreDeals] ${chain.label} locations: ${storeLocations[chain.key].length}`);
    }

    // ── 4. Write deals_instore ───────────────────────────────────
    let written = 0;
    const batch = db.batch();

    for (const chain of STORE_CHAINS) {
      const deals = dealsByStore[chain.key] ?? [];
      const stores = storeLocations[chain.key] ?? [];

      if (deals.length === 0 || stores.length === 0) continue;

      // Distribute deals across stores (round-robin)
      const maxDeals = Math.min(deals.length, 15);
      for (let i = 0; i < maxDeals; i++) {
        const deal = deals[i];
        const store = stores[i % stores.length];

        const price = parsePrice(deal.price) ?? deal.price;
        const originalPrice = parsePrice(deal.originalPrice) ?? deal.originalPrice ?? null;

        if (!price) continue;

        const discountPercent = deal.discountPercent ??
          (originalPrice && originalPrice > price
            ? Math.round(((originalPrice - price) / originalPrice) * 100)
            : null);

        const imageUrl = deal.imageUrl ?? deal.image ?? null;
        const dealId = deal.id ?? `${chain.key}_${i}`;
        const id = `instore_${chain.key}_${dealId}_${store.id}`;
        const ref = db.collection("deals_instore").doc(id);

        batch.set(ref, {
          id,
          title: deal.title ?? deal.name ?? `${chain.label} Deal`,
          price,
          originalPrice: originalPrice ?? null,
          discountPercent: discountPercent ?? null,
          store: store.displayName?.text ?? chain.label,
          storeKey: chain.key,
          category: deal.category ?? "Other",
          storeAddress: store.formattedAddress ?? "",
          latitude: store.location.latitude,
          longitude: store.location.longitude,
          imageUrl,
          affiliateUrl: deal.affiliateUrl ?? null,
          url: deal.affiliateUrl ?? deal.url ?? null,
          source: `${chain.key}_instore`,
          hot: (discountPercent ?? 0) >= 30,
          rare: (discountPercent ?? 0) >= 50,
          lightning: (discountPercent ?? 0) >= 70,
          live: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        written++;
      }
    }

    await batch.commit();
    console.log(`[InstoreDeals] Written ${written} in-store deals`);
    res.json({ success: true, written });
  }
);