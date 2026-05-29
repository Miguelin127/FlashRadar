// flashradar/screens/ExploreScreen.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, RefreshControl, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";

/* ─── Types ──────────────────────────────────────────────────── */

export type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  url?: string | null;
  merchantUrl?: string | null;
  affiliateUrl?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;
  couponCode?: string | null;
  promoCode?: string | null;
  dealScore?: number | null;
  asin?: string | null;
  publishedAt?: any;
  createdAt?: any;
  expired?: boolean;
  resaleIntel?: {
    profitPotential: number;
    roiPercent: number;
    demandLevel: string;
  } | null;
};

/* ─── Constants ──────────────────────────────────────────────── */

const ACCENT = "#FF7A00";
const QUERY_LIMIT = 500;

const PREMIUM_STORES = [
  "amazon", "bestbuy", "costco", "samsclub", "lowes",
  "apple", "nordstrom", "bloomingdales", "neimanmarcus",
  "saks", "macys", "sephora", "nike", "footlocker",
  "gamestop", "tjmaxx", "marshalls", "ross", "burlington",
];

const FILTERS = ["all", "hot", "rare", "lightning", "code"] as const;
type FilterType = typeof FILTERS[number];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "discount", label: "% Off" },
  { key: "price-low", label: "Price ↑" },
  { key: "price-high", label: "Price ↓" },
] as const;
type SortKey = typeof SORT_OPTIONS[number]["key"];

/* ─── Screen ─────────────────────────────────────────────────── */

export default function ExploreScreen() {
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [gridMode, setGridMode] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const listRef = useRef<FlatList>(null);
  const backToTopAnim = useRef(new Animated.Value(0)).current;
  const { theme, colors } = useTheme();
  const dark = theme === "dark";
  const navigation = useNavigation<any>();
  const { isPremium } = useUser();

  /* ── Load deals ── */
  useEffect(() => {
    const unsub = db
      .collection("deals_live")
      .orderBy("createdAt", "desc")
      .limit(QUERY_LIMIT)
      .onSnapshot(
        (snap) => {
          const rows: Deal[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              title: data.title ?? "Deal",
              store: data.store ?? data.storeKey ?? "Retailer",
              storeKey: data.storeKey ?? null,
              price: Number(data.price ?? 0),
              originalPrice: data.originalPrice ?? null,
              discountPercent: data.discountPercent ?? null,
              url: data.url ?? null,
              merchantUrl: data.merchantUrl ?? null,
              affiliateUrl: data.affiliateUrl ?? null,
              image: data.imageUrl ?? data.image ?? null,
              imageUrl: data.imageUrl ?? data.image ?? null,
              hot: !!data.hot,
              rare: !!data.rare,
              lightning: !!data.lightning,
              live: data.live ?? true,
              couponCode: data.couponCode ?? data.promoCode ?? null,
              promoCode: data.promoCode ?? null,
              dealScore: data.dealScore ?? null,
              asin: data.asin ?? null,
              publishedAt: data.publishedAt ?? null,
              createdAt: data.createdAt ?? null,
              expired: data.expired ?? false,
              resaleIntel: data.resaleIntel ?? null,
            };
          });
          setRawDeals(rows);
          setLoading(false);
          setRefreshing(false);
        },
        () => { setLoading(false); setRefreshing(false); }
      );
    return () => unsub();
  }, []);

  /* ── Filter + Sort ── */
  const visibleDeals = useMemo(() => {
    let list = rawDeals;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.title.toLowerCase().includes(q) || d.store.toLowerCase().includes(q)
      );
    }

    if (filter === "hot") list = list.filter((d) => d.hot);
    else if (filter === "rare") list = list.filter((d) => d.rare);
    else if (filter === "lightning") list = list.filter((d) => d.lightning);
    else if (filter === "code") list = list.filter((d) => !!(d.couponCode || d.promoCode));

    list = [...list].sort((a, b) => {
      if (sort === "discount") return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      if (sort === "price-low") return (a.price ?? 0) - (b.price ?? 0);
      if (sort === "price-high") return (b.price ?? 0) - (a.price ?? 0);
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });

    return list;
  }, [rawDeals, search, filter, sort]);

  const lockedCount = useMemo(() => {
    if (isPremium) return 0;
    return rawDeals.filter(d =>
      PREMIUM_STORES.includes((d.storeKey || "").toLowerCase())
    ).length;
  }, [rawDeals, isPremium]);

  /* ── Back to top ── */
  const handleScroll = (e: any) => {
    const y = e.nativeEvent.contentOffset.y;
    const shouldShow = y > 400;
    if (shouldShow !== showBackToTop) {
      setShowBackToTop(shouldShow);
      Animated.timing(backToTopAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const scrollToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  /* ── Render item ── */
  const renderItem = ({ item }: { item: Deal }) => {
    const isLocked = !isPremium && PREMIUM_STORES.includes((item.storeKey || "").toLowerCase());
    return (
      <DealCard
        deal={item}
        darkMode={dark}
        compact={gridMode}
        blurred={isLocked}
        onPress={() => {
          if (isLocked) {
            navigation.navigate("Upgrade");
            return;
          }
          navigation.navigate("DealDetail", { deal: item });
        }}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>

      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: dark ? "#fff" : "#111" }]}>Explore Deals</Text>
          <TouchableOpacity
            onPress={() => setGridMode((v) => !v)}
            style={[styles.layoutBtn, { backgroundColor: dark ? "#1a1a1a" : "#eee" }]}
          >
            <Ionicons name={gridMode ? "list-outline" : "grid-outline"} size={18} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: dark ? "#1a1a1a" : "#f0f0f0" }]}>
          <Ionicons name="search-outline" size={15} color="#888" />
          <TextInput
            placeholder="Search deals or stores..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: dark ? "#fff" : "#111" }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={15} color="#888" />
            </TouchableOpacity>
          )}
        </View>

        {/* Premium banner */}
        {!isPremium && lockedCount > 0 && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => navigation.navigate("Upgrade")}
          >
            <Ionicons name="lock-closed-outline" size={13} color={ACCENT} />
            <Text style={styles.premiumBannerText}>
              🔒 {lockedCount} premium deals locked — Tap to unlock
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#888" />
          </TouchableOpacity>
        )}

        {/* Filter chips */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS as unknown as FilterType[]}
          keyExtractor={(f) => f}
          style={styles.filterList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              onPress={() => setFilter(f)}
              style={[
                styles.chip,
                { backgroundColor: filter === f ? ACCENT : dark ? "#1a1a1a" : "#eee" },
              ]}
            >
              <Text style={[styles.chipText, { color: filter === f ? "#000" : dark ? "#aaa" : "#555" }]}>
                {f === "all" ? "ALL"
                  : f === "hot" ? "🔥 HOT"
                  : f === "rare" ? "💎 RARE"
                  : f === "lightning" ? "⚡ LIGHTNING"
                  : "🏷 GET CODE"}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Sort row */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={SORT_OPTIONS as unknown as typeof SORT_OPTIONS[number][]}
          keyExtractor={(s) => s.key}
          style={styles.sortList}
          renderItem={({ item: s }) => (
            <TouchableOpacity
              onPress={() => setSort(s.key)}
              style={[styles.sortChip, sort === s.key && { borderColor: ACCENT }]}
            >
              <Text style={[styles.sortText, { color: sort === s.key ? ACCENT : dark ? "#888" : "#666" }]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Results count */}
        <Text style={styles.resultsCount}>
          {visibleDeals.length} deals{!isPremium ? " · Upgrade to unlock all stores" : ""}
        </Text>
      </View>

      {/* ── DEAL LIST ── */}
      <FlatList
        ref={listRef}
        data={visibleDeals}
        key={gridMode ? "grid" : "list"}
        keyExtractor={(item) => item.id}
        numColumns={gridMode ? 2 : 1}
        contentContainerStyle={[styles.list, gridMode && styles.gridPadding]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wifi-outline" size={40} color="#444" />
            <Text style={styles.emptyTitle}>RADAR SILENCE</Text>
            <Text style={styles.emptySub}>No deals match this frequency.</Text>
          </View>
        }
        ListFooterComponent={
          !isPremium ? (
            <TouchableOpacity
              style={styles.unlockBox}
              onPress={() => navigation.navigate("Upgrade")}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.unlockTitle}>Premium Stores Locked</Text>
                <Text style={styles.unlockSub}>
                  Amazon, Best Buy, Costco, Apple Store + more · Go Premium
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </TouchableOpacity>
          ) : <View style={{ height: 100 }} />
        }
        renderItem={renderItem}
      />

      {/* ── BACK TO TOP ── */}
      <Animated.View
        style={[styles.backToTop, { opacity: backToTopAnim, transform: [{ scale: backToTopAnim }] }]}
        pointerEvents={showBackToTop ? "auto" : "none"}
      >
        <TouchableOpacity onPress={scrollToTop} style={styles.backToTopBtn}>
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 24, fontWeight: "900" },
  layoutBtn: { padding: 8, borderRadius: 10 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 10, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  premiumBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,122,0,0.08)",
    borderWidth: 1, borderColor: "rgba(255,122,0,0.25)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10,
  },
  premiumBannerText: { flex: 1, color: ACCENT, fontSize: 12, fontWeight: "700" },
  filterList: { marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginRight: 6 },
  chipText: { fontSize: 11, fontWeight: "800" },
  sortList: { marginBottom: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#333", marginRight: 6 },
  sortText: { fontSize: 11, fontWeight: "700" },
  resultsCount: { fontSize: 10, color: "#666", marginBottom: 4, fontWeight: "600" },
  list: { paddingHorizontal: 8, paddingBottom: 40 },
  gridPadding: { paddingHorizontal: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { color: "#555", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptySub: { color: "#666", fontSize: 13 },
  unlockBox: {
    backgroundColor: "#111", borderWidth: 1, borderColor: ACCENT + "33",
    margin: 12, padding: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  unlockTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  unlockSub: { color: "#888", fontSize: 12, marginTop: 2 },
  backToTop: { position: "absolute", right: 16, bottom: 30 },
  backToTopBtn: {
    backgroundColor: ACCENT, padding: 12, borderRadius: 999,
    shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
});