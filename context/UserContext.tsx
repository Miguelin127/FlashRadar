// flashradar/context/UserContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import { useAuth } from "./AuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// Store access tiers
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_STORES = new Set([
  "walmart", "target", "home depot", "homedepot",
  "target.com", "walmart.com",
]);

export const PREMIUM_STORES = new Set([
  // Free stores included
  "walmart", "target", "home depot", "homedepot",
  // Premium additions
  "amazon", "bestbuy", "best buy", "costco",
  "sams club", "sam's club", "lowes", "lowe's",
  "slickdeals", "ebay", "nike", "online",
  // catch-all for ingested deals without explicit store
  "retailer",
]);

export function isStoreAccessible(store: string, isPremium: boolean): boolean {
  const normalized = (store || "").toLowerCase().trim()
    .replace(".com", "").replace(/\s+/g, " ");
  if (isPremium) return true;
  return FREE_STORES.has(normalized);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

type UserContextType = {
  isPremium: boolean;
  subscriptionStatus: string;
  loading: boolean;
  trialActive: boolean;
  trialEndsAt: Date | null;
};

const UserContext = createContext<UserContextType>({
  isPremium: false,
  subscriptionStatus: "none",
  loading: true,
  trialActive: false,
  trialEndsAt: null,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState("none");
  const [trialActive, setTrialActive] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setSubscriptionStatus("none");
      setTrialActive(false);
      setTrialEndsAt(null);
      setLoading(false);
      return;
    }

    const unsub = db
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (snap) => {
          const data = snap.data();
          const status: string = data?.subscriptionStatus ?? "none";
          const trial = !!data?.trialActive;
          const trialEnd = data?.trialEnds?.toDate?.() ?? null;

          const premiumActive =
            status === "active" ||
            trial ||
            data?.premium === true ||
            data?.isPremium === true;

          setSubscriptionStatus(status);
          setIsPremium(premiumActive);
          setTrialActive(trial);
          setTrialEndsAt(trialEnd);
          setLoading(false);
        },
        (error) => {
          console.error("[UserContext] listener error:", error);
          setIsPremium(false);
          setSubscriptionStatus("error");
          setLoading(false);
        }
      );

    return () => unsub();
  }, [user]);

  return (
    <UserContext.Provider value={{ isPremium, subscriptionStatus, loading, trialActive, trialEndsAt }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);