import { db } from "../firebaseConfig";

export type StoreEntry = {
  key: string;
  label: string;
  count: number;
};

let cache: StoreEntry[] | null = null;
let inFlight: Promise<StoreEntry[]> | null = null;

export async function loadStoreIndex(): Promise<StoreEntry[]> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = db
    .collection("config")
    .doc("storeIndex")
    .get()
    .then((snap) => {
      const raw = snap.data()?.stores;
      cache = Array.isArray(raw) ? (raw as StoreEntry[]) : [];
      return cache;
    })
    .catch(() => {
      cache = [];
      return [];
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
