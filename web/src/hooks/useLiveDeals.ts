// web/src/hooks/useLiveDeals.ts
import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";

/* ───────────────────────── Firebase Setup ───────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyB7gxV9ssBg7T8p0ttjfiFLzXi6w6dPkOs",
  authDomain: "flashradar-71c93.firebaseapp.com",
  projectId: "flashradar-71c93",
  storageBucket: "flashradar-71c93.appspot.com",
  messagingSenderId: "2868928124",
  appId: "1:2868928124:web:de1db7082e461f70e033f9",
};

// ✅ Ensure only one Firebase instance (fixes Vite hot-reload duplication)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

/* ───────────────────────── Types ───────────────────────── */
export type Deal = {
  id: string;
  title?: string;
  store?: string;
  price?: number;
  originalPrice?: number;
  discountPct?: number;
  category?: string;
  image?: string;
  imgUrl?: string;
  rare?: boolean;
  isHot?: boolean;
  latitude?: number;
  longitude?: number;
  timestamp?: any;
  source?: "local" | "online";
};

/* ───────────────────────── Hook ───────────────────────── */
export function useLiveDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const dealsRef = collection(db, "deals");
      const onlineRef = collection(db, "deals_online");

      const q1 = query(dealsRef, orderBy("timestamp", "desc"));
      const q2 = query(onlineRef, orderBy("timestamp", "desc"));

      const unsub1 = onSnapshot(q1, (snap) => {
        const local: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Deal[];

        setDeals((prev: Deal[]) => {
          const existingOnline = prev.filter(
            (x) => x.source === "online"
          );
          const merged: Deal[] = [
            ...local.map((d) => ({ ...d, source: "local" as const })),
            ...existingOnline,
          ];
          return merged;
        });
      });

      const unsub2 = onSnapshot(q2, (snap) => {
        const online: Deal[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Deal[];

        setDeals((prev: Deal[]) => {
          const existingLocal = prev.filter(
            (x) => x.source === "local"
          );
          const merged: Deal[] = [
            ...existingLocal,
            ...online.map((d) => ({ ...d, source: "online" as const })),
          ];
          return merged;
        });

        setLoading(false);
      });

      return () => {
        unsub1();
        unsub2();
      };
    } catch (err) {
      console.error("❌ useLiveDeals merge error:", err);
      setLoading(false);
    }
  }, []);

  return { deals, loading };
}
