// flashradar/screens/RadarScreen.tsx

import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Linking, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { useNavigation } from "@react-navigation/native";
import { usePulseAnimation } from "../FlashRadar/hooks/usePulseAnimation";

/* ───────────────── TYPES ───────────────── */

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  image?: string | null;
  imageUrl?: string | null;
  merchantUrl?: string;
  affiliateUrl?: string;
  url?: string;
  live?: boolean;
  hot?: boolean;
  rare?: boolean;
  isSaved?: boolean;
  updatedAt?: any;
};

/* ───────────────── HELPERS ───────────────── */

function minutesLeft(updatedAt?: any) {
  if (!updatedAt?.toDate) return null;
  const start = updatedAt.toDate().getTime();
  const expires = start + 24 * 60 * 60 * 1000;
  const diff = Math.floor((expires - Date.now()) / 60000);
  return diff > 0 ? diff : null;
}

/* ───────────────── COMPONENT ───────────────── */

// Max deals fetched per query — prevents runaway Firestore reads.
// Premium users see all VISIBLE_LIMIT deals; free users see first 3.
const VISIBLE_LIMIT = 50;

export default function RadarScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  const isDark = theme === "dark";
  const { triggerPulse, ringStyle } = usePulseAnimation(300, 1.3);

  // ── Premium status from context — no extra Firestore listener needed ────────
  // Previously RadarScreen opened its own onSnapshot for premium status.
  // That's now handled by UserContext (wired in App.tsx) and shared globally.
  const { isPremium } = useUser();

  /* ───────── LIVE DEAL QUERY ───────── */

  useEffect(() => {
    // ── Compat SDK — matches the db instance from firebaseConfig.ts ───────────
    // Previously used modular SDK (collection/query/onSnapshot from
    // "firebase/firestore") which silently fails with a compat db instance.
    const q = db
      .collection("deals_live")
      .where("live", "==", true)
      .orderBy("updatedAt", "desc")
      .limit(VISIBLE_LIMIT); // Hard cap — prevents full collection scans

    const unsub = q.onSnapshot(
      (snap) => {
        const rows: Deal[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title,
            store: data.store,
            price: Number(data.price ?? 0),
            image: data.image ?? null,
            imageUrl: data.imageUrl ?? null,
            merchantUrl: data.merchantUrl ?? null,
            affiliateUrl: data.affiliateUrl ?? null,
            url: data.url ?? null,
            live: data.live,
            hot: data.hot,
            rare: data.rare,
            updatedAt: data.updatedAt,
            isSaved: data.isSaved ?? false,
          };
        });

        setDeals(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  /* ───────── PREMIUM GATE ───────── */

  const visibleDeals = useMemo(
    () => (isPremium ? deals : deals.slice(0, 3)),
    [deals, isPremium]
  );

  /* ───────── ACTIONS ───────── */

  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;

    triggerPulse();

    const ref = db
      .collection("users")
      .doc(user.uid)
      .collection("favorites")
      .doc(deal.id);

    if (deal.isSaved) {
      await ref.delete();
    } else {
      await ref.set(deal, { merge: true });
    }

    setDeals((prev) =>
      prev.map((d) =>
        d.id === deal.id ? { ...d, isSaved: !d.isSaved } : d
      )
    );
  };

  const openDeal = async (deal: Deal) => {
    // ── Affiliate URL first — always send tracked links ───────────────────────
    // Previously merchantUrl was checked first, bypassing affiliate tracking.
    // affiliateUrl contains the flashradar20-20 tag — this is how we get paid.
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn("Failed to open deal URL", e);
    }
  };

  /* ───────── UI ───────── */

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.liveStrip, { borderColor: colors.accent }]}>
        <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.liveText, { color: colors.accent }]}>
          LIVE DEAL RADAR — EXPIRING FAST
        </Text>
      </View>

      <FlatList
        data={visibleDeals}
        keyExtractor={(item) => `${item.id}-${item.price}`}
        contentContainerStyle={{ padding: 10 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.text }]}>
            No live deals right now.
          </Text>
        }
        renderItem={({ item }) => {
          const mins = minutesLeft(item.updatedAt);

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? "#1E1E1E" : "#fff",
                  borderColor: isDark ? "#333" : "#ddd",
                },
              ]}
            >
              <Animated.View style={[styles.liveBadge, ringStyle]}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </Animated.View>

              <DealCard
                deal={item}
                onPress={() =>
                  (navigation as any).navigate("DealDetail", { deal: item })
                }
                onSaveToggle={() => toggleSave(item)}
                darkMode={isDark}
              />

              {mins !== null && (
                <Text style={styles.timer}>⏱️ {mins} min left</Text>
              )}

              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => openDeal(item)}
              >
                <Text style={styles.openText}>Open Deal</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* 🔒 UNLOCK CTA */}
      {!isPremium && deals.length > 3 && (
        <TouchableOpacity
          style={[styles.unlockBox, { backgroundColor: colors.accent }]}
          onPress={() => (navigation as any).navigate("Upgrade")}
        >
          <Text style={styles.unlockTitle}>🔓 Unlock All Deals</Text>
          <Text style={styles.unlockSub}>
            See all live deals · Remove limits
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

/* ───────────────── STYLES ───────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  liveStrip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    margin: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  liveText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    position: "relative",
  },
  liveBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#FF3B30",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 10,
  },
  liveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  timer: { marginTop: 4, marginLeft: 6, fontSize: 11, color: "#FF3B30", fontWeight: "700" },
  openBtn: {
    marginTop: 8,
    backgroundColor: "#FF6600",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  openText: { color: "#fff", fontWeight: "900" },
  unlockBox: { margin: 16, padding: 16, borderRadius: 14, alignItems: "center" },
  unlockTitle: { color: "#fff", fontWeight: "900", fontSize: 16 },
  unlockSub: { color: "#fff", opacity: 0.9, marginTop: 4 },
  empty: { textAlign: "center", marginTop: 30, fontSize: 16 },
});