import { db } from "../firebaseConfig";

export type StoreCoupon = {
  code: string;
  terms: string;
  minSpend?: number;
};

let cache: Record<string, StoreCoupon[]> | null = null;
let inFlight: Promise<Record<string, StoreCoupon[]>> | null = null;

export async function loadStoreCoupons(): Promise<Record<string, StoreCoupon[]>> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = db
    .collection("config")
    .doc("storeCoupons")
    .get()
    .then((snap) => {
      const data = snap.data() || {};
      const out: Record<string, StoreCoupon[]> = {};
      Object.keys(data).forEach((k) => {
        if (Array.isArray(data[k])) out[k] = data[k] as StoreCoupon[];
      });
      cache = out;
      return out;
    })
    .catch(() => {
      cache = {};
      return {};
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export async function getCouponsForStore(storeKey?: string): Promise<StoreCoupon[]> {
  if (!storeKey) return [];
  const all = await loadStoreCoupons();
  return all[storeKey.toLowerCase()] || [];
}
