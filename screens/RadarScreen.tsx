// flashradar/screens/RadarScreen.tsx

import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Linking, Animated, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { useNavigation } from "@react-navigation/native";
import { usePulseAnimation } from "../FlashRadar/hooks/usePulseAnimation";

/* ─── Types ─────────────────────────────────────────────────── */

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
  discountPercent?: number | null;
  originalPrice?: number | null;
  updatedAt?: any;
  createdAt?: any;
  resaleIntel?: {
    profitPotential: number;
    roiPercent: number;
    demandLevel: string;
  } | null;
};

/* ─── Constants ──────────────────────────────────────────────── */

const ACCENT = "#FF7A00";
const FREE_LIMIT = 5;
const QUERY_LIMIT = 100;

/* ─── Stat Card ──────────────────────────────────────────────── */

function StatCard({
  icon, label, value, color, dark,
}: {
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  label: string; value: string | number; color: string; dark: boolean;
}) {
  return (
    <View style={[sc.card, { backgroundColor: dark ? "#1a1a1a" : "#f5f5f5" }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[sc.val, { color: dark ? "#fff" : "#111" }]}>{value}</Text>
      <Text style={sc.lbl}>{label}</Text>
    </View>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", margin: 4 },
  val: { fontSize: 18, fontWeight: "900", marginTop: 4 },
  lbl: { fontSize: 10, color: "#888", marginTop: 2, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
});

/* ─── Main Screen ────────────────────────────────────────────── */

export default function RadarScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "hot" | "rare">("all");

  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  const dark = theme === "dark";
  const { isPremium } = useUser();
  const { triggerPulse } = usePulseAnimation(300, 1.3);

  /* ── Pulse animation for live dot ── */
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  /* ── Load deals — queries all active collections ── */
  useEffect(() => {
    const results: Record<string, Deal> = {};
    let resolved = 0;
    const COLLECTIONS = ["deals_online", "deals_live", "best_buy_deals", "target_deals"];

    const unsubscribers = COLLECTIONS.map((col) => {
      return db
        .collection(col)
        .orderBy("createdAt", "desc")
        .limit(QUERY_LIMIT)
        .onSnapshot(
          (snap) => {
            snap.docs.forEach((d) => {
              const data = d.data() as any;
              if (!results[d.id]) {
                results[d.id] = {
                  id: d.id,
                  title: data.title ?? "Deal",
                  store: data.store ?? data.storeKey ?? "Retailer",
                  price: Number(data.price ?? 0),
                  image: data.imageUrl ?? data.image ?? null,
                  imageUrl: data.imageUrl ?? data.image ?? null,
                  merchantUrl: data.merchantUrl ?? null,
                  affiliateUrl: data.affiliateUrl ?? null,
                  url: data.url ?? null,
                  live: data.live ?? true,
                  hot: !!data.hot,
                  rare: !!data.rare,
                  discountPercent: data.discountPercent ?? null,
                  originalPrice: data.originalPrice ?? null,
                  updatedAt: data.updatedAt ?? data.createdAt,
                  createdAt: data.createdAt,
                  resaleIntel: data.resaleIntel ?? null,
                };
              }
            });
            resolved++;
            if (resolved >= COLLECTIONS.length) {
              const sorted = Object.values(results).sort((a, b) => {
                const ta = a.createdAt?.seconds ?? 0;
                const tb = b.createdAt?.seconds ?? 0;
                return tb - ta;
              });
              setDeals(sorted);
              setLoading(false);
            }
          },
          () => {
            resolved++;
            if (resolved >= COLLECTIONS.length) setLoading(false);
          }
        );
    });

    return () => unsubscribers.forEach((u) => u());
  }, []);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    hot: deals.filter((d) => d.hot).length,
    rare: deals.filter((d) => d.rare).length,
    stores: new Set(deals.map((d) => d.store?.toLowerCase())).size,
  }), [deals]);

  /* ── Filter + Search + Gate ── */
  const visibleDeals = useMemo(() => {
    let list = deals;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.title.toLowerCase().includes(q) || d.store.toLowerCase().includes(q)
      );
    }

    if (filterMode === "hot") list = list.filter((d) => d.hot);
    if (filterMode === "rare") list = list.filter((d) => d.rare);

    if (!isPremium) list = list.slice(0, FREE_LIMIT);

    return list;
  }, [deals, search, filterMode, isPremium]);

  /* ── Open deal ── */
  const openDeal = async (deal: Deal) => {
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (!url) return;
    try { await Linking.openURL(url); } catch (e) { console.warn(e); }
  };

  /* ── Toggle save ── */
  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;
    triggerPulse();
    const ref = db.collection("users").doc(user.uid).collection("favorites").doc(deal.id);
    if (deal.isSaved) {
      await ref.delete();
    } else {
      await ref.set(deal, { merge: true });
    }
    setDeals((prev) =>
      prev.map((d) => d.id === deal.id ? { ...d, isSaved: !d.isSaved } : d)
    );
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.loadingHeader}>
          <Ionicons name="radio-outline" size={20} color={ACCENT} />
          <Text style={styles.loadingTitle}>SCANNING RADAR...</Text>
        </View>
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={[styles.skeletonCard, { backgroundColor: dark ? "#1a1a1a" : "#f0f0f0" }]}>
              <View style={[styles.skeletonImg, { backgroundColor: dark ? "#2a2a2a" : "#e0e0e0" }]} />
              <View style={[styles.skeletonLine, { backgroundColor: dark ? "#2a2a2a" : "#e0e0e0", width: "80%" }]} />
              <View style={[styles.skeletonLine, { backgroundColor: dark ? "#2a2a2a" : "#e0e0e0", width: "50%" }]} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        data={visibleDeals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.radarIconWrap}>
                  <Ionicons name="radio-outline" size={22} color={ACCENT} />
                  <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, { color: dark ? "#fff" : "#111" }]}>
                    DEAL RADAR
                  </Text>
                  <Text style={styles.headerSub}>
                    {isPremium ? "⚡ Premium Feed" : "Standard Access"} · {deals.length} Live Hits
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Stat Cards ── */}
            <View style={styles.statsRow}>
              <StatCard icon="flame-outline" label="Hot Deals" value={stats.hot} color="#FF4500" dark={dark} />
              <StatCard icon="diamond-outline" label="Rare Finds" value={stats.rare} color="#3b82f6" dark={dark} />
              <StatCard icon="storefront-outline" label="Stores" value={stats.stores} color={ACCENT} dark={dark} />
            </View>

            {/* ── Search ── */}
            <View style={[styles.searchBox, { backgroundColor: dark ? "#1a1a1a" : "#f0f0f0" }]}>
              <Ionicons name="search-outline" size={16} color="#888" />
              <TextInput
                placeholder="Search deals or stores..."
                placeholderTextColor="#888"
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: dark ? "#fff" : "#111" }]}
              />
            </View>

            {/* ── Filter Chips ── */}
            <View style={styles.filterRow}>
              {(["all", "hot", "rare"] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilterMode(f)}
                  style={[styles.chip, filterMode === f && { backgroundColor: ACCENT }]}
                >
                  <Text style={[styles.chipText, filterMode === f && { color: "#fff" }]}>
                    {f === "all" ? "ALL" : f === "hot" ? "🔥 HOT" : "💎 RARE"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wifi-outline" size={40} color="#444" />
            <Text style={styles.emptyTitle}>RADAR SILENCE</Text>
            <Text style={styles.emptySub}>No matching deals on this frequency.</Text>
          </View>
        }
        ListFooterComponent={
          !isPremium && deals.length > FREE_LIMIT ? (
            <TouchableOpacity
              style={styles.unlockBox}
              onPress={() => (navigation as any).navigate("Upgrade")}
            >
              <Ionicons name="lock-closed-outline" size={20} color="#fff" />
              <View>
                <Text style={styles.unlockTitle}>Elite Frequencies Locked</Text>
                <Text style={styles.unlockSub}>
                  {deals.length - FREE_LIMIT} more deals · Upgrade to Premium
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.cardWrap, { backgroundColor: dark ? "#111" : "#fff" }]}>
            {item.hot && (
              <View style={styles.hotBadge}>
                <Text style={styles.hotBadgeText}>🔥 HOT</Text>
              </View>
            )}
            {item.rare && (
              <View style={[styles.hotBadge, { backgroundColor: "#3b82f6" }]}>
                <Text style={styles.hotBadgeText}>💎 RARE</Text>
              </View>
            )}
            <DealCard
              deal={item}
              onPress={() => (navigation as any).navigate("DealDetail", { deal: item })}
              onSaveToggle={() => toggleSave(item)}
              darkMode={dark}
            />
            <TouchableOpacity style={styles.openBtn} onPress={() => openDeal(item)}>
              <Text style={styles.openText}>Open Deal</Text>
              <Ionicons name="chevron-forward" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 12, paddingBottom: 100 },

  // Loading
  loadingHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  loadingTitle: { color: ACCENT, fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  skeletonGrid: { flexDirection: "row", flexWrap: "wrap", padding: 8 },
  skeletonCard: { width: "47%", margin: "1.5%", borderRadius: 12, padding: 12 },
  skeletonImg: { width: "100%", height: 120, borderRadius: 8, marginBottom: 8 },
  skeletonLine: { height: 10, borderRadius: 5, marginBottom: 6 },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  radarIconWrap: { position: "relative", width: 44, height: 44, borderRadius: 12, backgroundColor: "#FF7A0022", justifyContent: "center", alignItems: "center" },
  liveDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
  headerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  headerSub: { fontSize: 11, color: "#888", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },

  // Stats
  statsRow: { flexDirection: "row", marginBottom: 12 },

  // Search
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 12, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14 },

  // Filters
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "#222" },
  chipText: { fontSize: 11, fontWeight: "800", color: "#888" },

  // Cards
  cardWrap: { borderRadius: 14, padding: 8, marginBottom: 10, position: "relative" },
  hotBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#FF4500", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, zIndex: 10 },
  hotBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },

  // Open btn
  openBtn: { backgroundColor: ACCENT, paddingVertical: 10, borderRadius: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 6 },
  openText: { color: "#000", fontWeight: "900", fontSize: 14 },

  // Unlock CTA
  unlockBox: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: ACCENT + "44", margin: 8, padding: 16, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  unlockTitle: { color: "#fff", fontWeight: "900", fontSize: 15 },
  unlockSub: { color: "#888", fontSize: 12, marginTop: 2 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { color: "#555", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptySub: { color: "#666", fontSize: 13 },
});