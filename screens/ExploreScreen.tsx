// flashradar/screens/ExploreScreen.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, RefreshControl, Animated, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { db, functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";
import { PREMIUM_STORES, FREE_DEAL_LIMIT, isStoreLocked } from "../constants/premiumStores";
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
const QUERY_LIMIT = 4000;
const PAGE_SIZE = 40;

// Weave free + premium deals: 20 free, then 6 premium, repeat.
// premium is pre-shuffled (session-stable) by the caller.
function interleaveFeed(free: Deal[], premium: Deal[]): Deal[] {
  const FREE_CHUNK = 20;
  const PREM_CHUNK = 6;
  const out: Deal[] = [];
  let fi = 0, pi = 0;
  while (fi < free.length || pi < premium.length) {
    for (let i = 0; i < FREE_CHUNK && fi < free.length; i++) out.push(free[fi++]);
    for (let i = 0; i < PREM_CHUNK && pi < premium.length; i++) out.push(premium[pi++]);
  }
  return out;
}

// Deterministic shuffle from a numeric seed (session-stable).
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FILTERS = ["all", "hot", "rare", "lightning", "code"] as const;
type FilterType = typeof FILTERS[number];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "discount", label: "% Off ↓" },
  { key: "discount-low", label: "% Off ↑" },
  { key: "price-low", label: "Price ↑" },
  { key: "price-high", label: "Price ↓" },
] as const;
type SortKey = typeof SORT_OPTIONS[number]["key"];

const PRICE_RANGES = [
  { key: "all", label: "Any Price", min: 0, max: Infinity },
  { key: "u25", label: "Under $25", min: 0, max: 25 },
  { key: "25-100", label: "$25–100", min: 25, max: 100 },
  { key: "100-500", label: "$100–500", min: 100, max: 500 },
  { key: "500+", label: "$500+", min: 500, max: Infinity },
] as const;
type PriceKey = typeof PRICE_RANGES[number]["key"];

/* ─── Helpers ────────────────────────────────────────────────── */

function mapDoc(d: any): Deal {
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
}

// Title-case a storeKey for display (e.g. "bestbuy" -> "Bestbuy", "homedepot" -> "Homedepot")
function prettyStore(key: string): string {
  if (!key) return "Store";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/* ─── Screen ─────────────────────────────────────────────────── */

export default function ExploreScreen() {
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<PriceKey>("all");
  const [tierFilter, setTierFilter] = useState<"free" | "all">("all");
  const shuffleSeed = useRef(Math.floor(Math.random() * 100000)).current;
  const [openPanel, setOpenPanel] = useState<"filter" | "stores" | "arrange" | null>(null);
  const [gridMode, setGridMode] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const listRef = useRef<FlatList>(null);
  const backToTopAnim = useRef(new Animated.Value(0)).current;
  const { theme, colors } = useTheme();
  const dark = theme === "dark";
  const navigation = useNavigation<any>();
  const { isPremium, isAdmin } = useUser();
  const [aiSearching, setAiSearching] = useState(false);

  // Map a numeric price ceiling to the nearest PriceKey range.
  const mapPriceToRange = (max: number | null): PriceKey => {
    if (max == null) return "all";
    if (max <= 25) return "u25";
    if (max <= 100) return "25-100";
    if (max <= 500) return "100-500";
    return "500+";
  };

  const runAiSearch = async () => {
    const q = search.trim();
    if (!q || aiSearching) return;
    setAiSearching(true);
    try {
      const call = httpsCallable(functions, "parseSearch");
      const res: any = await call({ query: q, isPremium });
      if (res.data?.limitReached) {
        Alert.alert(
          "Daily AI searches used",
          "You've used your 5 free AI searches today. Upgrade to Premium for unlimited AI search.",
          [{ text: "Not now", style: "cancel" }, { text: "Upgrade", onPress: () => navigation.navigate("Upgrade") }]
        );
        return;
      }
      const parsed = res.data?.parsed;
      if (parsed) {
        if (parsed.keywords) setSearch(parsed.keywords);
        setPriceRange(mapPriceToRange(parsed.priceMax ?? null));
        if (parsed.sortBy) setSort(parsed.sortBy);
        if (parsed.storeHint) {
          const hint = String(parsed.storeHint).toLowerCase();
          const match = storeOptions.find((so) => so.toLowerCase().includes(hint) || hint.includes(so.toLowerCase()));
          setStoreFilter(match || "all");
        }
      }
    } catch (e) {
      Alert.alert("AI search failed", "Please try again.");
    } finally {
      setAiSearching(false);
    }
  };

  /* ── Load deals — force server fetch first, then live updates ── */
  useEffect(() => {
    // Force server fetch to bypass Firestore cache
    db.collection("deals_live")
      .orderBy("createdAt", "desc")
      .limit(QUERY_LIMIT)
      .get({ source: "server" })
      .then((snap) => {
        setRawDeals(snap.docs.map(mapDoc));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Real-time listener for new deals
    const unsub = db
      .collection("deals_live")
      .orderBy("createdAt", "desc")
      .limit(QUERY_LIMIT)
      .onSnapshot(
        (snap) => {
          setRawDeals(snap.docs.map(mapDoc));
          setLoading(false);
          setRefreshing(false);
        },
        () => { setLoading(false); setRefreshing(false); }
      );
    return () => unsub();
  }, []);

  /* ── Store list derived from actual deals ── */
  const storeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of rawDeals) {
      const key = (d.storeKey || d.store || "").toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Sort by count desc so the biggest stores show first
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key);
  }, [rawDeals]);

  /* ── Filter + Sort ── */
  const visibleDeals = useMemo(() => {
    // Drop ghost/malformed deals (no image) that render as bare buttons
    let list = rawDeals.filter((d) => !!(d.imageUrl || d.image) && !d.expired && Number.isFinite(Number(d.price)) && Number(d.price) > 0);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.title.toLowerCase().includes(q) || d.store.toLowerCase().includes(q)
      );
    }

    // Store filter
    if (storeFilter !== "all") {
      list = list.filter(
        (d) => (d.storeKey || d.store || "").toLowerCase() === storeFilter
      );
    }

    // Price range filter
    if (priceRange !== "all") {
      const range = PRICE_RANGES.find((r) => r.key === priceRange);
      if (range) {
        list = list.filter((d) => d.price >= range.min && d.price < range.max);
      }
    }

    if (filter === "hot") list = list.filter((d) => d.hot);
    else if (filter === "rare") list = list.filter((d) => d.rare);
    else if (filter === "lightning") list = list.filter((d) => d.lightning);
    else if (filter === "code") list = list.filter((d) => !!(d.couponCode || d.promoCode));

    list = [...list].sort((a, b) => {
      if (sort === "discount") return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
      if (sort === "discount-low") return (a.discountPercent ?? 0) - (b.discountPercent ?? 0);
      if (sort === "price-low") return (a.price ?? 0) - (b.price ?? 0);
      if (sort === "price-high") return (b.price ?? 0) - (a.price ?? 0);
      const ta = a.createdAt?.seconds ?? 0;
      const tb = b.createdAt?.seconds ?? 0;
      return tb - ta;
    });

    // ── Tier handling (free users only; premium sees everything as-is) ──
    if (!isPremium) {
      const isPrem = (d: Deal) => PREMIUM_STORES.includes((d.storeKey || "").toLowerCase());
      const freeDeals = list.filter((d) => !isPrem(d));
      if (tierFilter === "free") {
        // Free tier: only free-store deals, no premium
        list = freeDeals;
      } else {
        // All tier: weave 20 free : 6 premium (premium shuffled, session-stable)
        const premDeals = seededShuffle(list.filter(isPrem), shuffleSeed);
        list = interleaveFeed(freeDeals, premDeals);
      }
    }

    // Free users capped at FREE_DEAL_LIMIT; premium unlimited
    if (!isPremium && list.length > FREE_DEAL_LIMIT) {
      list = list.slice(0, FREE_DEAL_LIMIT);
    }

    return list;
  }, [rawDeals, search, filter, sort, storeFilter, priceRange, isPremium, tierFilter, shuffleSeed]);

  // Reset pagination whenever the result set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filter, sort, storeFilter, priceRange]);

  // The slice actually rendered
  const pagedDeals = useMemo(
    () => visibleDeals.slice(0, visibleCount),
    [visibleDeals, visibleCount]
  );
  const hasMore = visibleCount < visibleDeals.length;

  const lockedCount = useMemo(() => {
    if (isPremium) return 0;
    return rawDeals.filter(d =>
      PREMIUM_STORES.includes((d.storeKey || "").toLowerCase()) && !d.expired
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
    db.collection("deals_live")
      .orderBy("createdAt", "desc")
      .limit(QUERY_LIMIT)
      .get({ source: "server" })
      .then((snap) => {
        setRawDeals(snap.docs.map(mapDoc));
        setRefreshing(false);
      })
      .catch(() => setRefreshing(false));
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
          {search.trim().length > 0 && (
            <TouchableOpacity onPress={runAiSearch} disabled={aiSearching} style={styles.aiBtn}>
              {aiSearching ? (
                <ActivityIndicator size="small" color="#FF7A00" />
              ) : (
                <Ionicons name="sparkles" size={16} color="#FF7A00" />
              )}
            </TouchableOpacity>
          )}
          {search.length > 0 && !aiSearching && (
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
              🔒 {isAdmin ? `${lockedCount} ` : ""}premium deals locked — Tap to unlock
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#888" />
          </TouchableOpacity>
        )}

        {/* Free / All tier toggle (free users only) */}
        {!isPremium && (
          <View style={styles.tierToggle}>
            {(["free", "all"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTierFilter(t)}
                style={[
                  styles.tierBtn,
                  { backgroundColor: tierFilter === t ? ACCENT : dark ? "#1a1a1a" : "#eee" },
                ]}
              >
                <Text style={[styles.tierBtnText, { color: tierFilter === t ? "#000" : dark ? "#aaa" : "#555" }]}>
                  {t === "free" ? "Free" : "All Deals"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Dropdown filter row */}
        <View style={styles.dropRow}>
          <TouchableOpacity
            style={[styles.dropBtn, { backgroundColor: dark ? "#1a1a1a" : "#eee" }, openPanel === "filter" && { borderColor: ACCENT, borderWidth: 1 }]}
            onPress={() => setOpenPanel(openPanel === "filter" ? null : "filter")}
          >
            <Text style={[styles.dropBtnText, { color: dark ? "#fff" : "#111" }]} numberOfLines={1}>
              {filter === "all" ? "Filter" : filter === "hot" ? "🔥 Hot" : filter === "rare" ? "💎 Rare" : filter === "lightning" ? "⚡ Lightning" : "🏷 Code"}
            </Text>
            <Text style={[styles.dropCaret, { color: dark ? "#aaa" : "#666" }]}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropBtn, { backgroundColor: dark ? "#1a1a1a" : "#eee" }, openPanel === "stores" && { borderColor: ACCENT, borderWidth: 1 }]}
            onPress={() => setOpenPanel(openPanel === "stores" ? null : "stores")}
          >
            <Text style={[styles.dropBtnText, { color: dark ? "#fff" : "#111" }]} numberOfLines={1}>
              {storeFilter === "all" ? "🏬 All Stores" : prettyStore(storeFilter)}
            </Text>
            <Text style={[styles.dropCaret, { color: dark ? "#aaa" : "#666" }]}>▾</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dropBtn, { backgroundColor: dark ? "#1a1a1a" : "#eee" }, openPanel === "arrange" && { borderColor: ACCENT, borderWidth: 1 }]}
            onPress={() => setOpenPanel(openPanel === "arrange" ? null : "arrange")}
          >
            <Text style={[styles.dropBtnText, { color: dark ? "#fff" : "#111" }]} numberOfLines={1}>
              Arrange By
            </Text>
            <Text style={[styles.dropCaret, { color: dark ? "#aaa" : "#666" }]}>▾</Text>
          </TouchableOpacity>
        </View>

        {openPanel === "filter" && (
          <View style={[styles.panel, { backgroundColor: dark ? "#141414" : "#f7f7f7" }]}>
            {(FILTERS as unknown as FilterType[]).map((f) => (
              <TouchableOpacity key={f} onPress={() => { setFilter(f); setOpenPanel(null); }}
                style={[styles.panelChip, { backgroundColor: filter === f ? ACCENT : dark ? "#242424" : "#fff" }]}>
                <Text style={[styles.panelChipText, { color: filter === f ? "#000" : dark ? "#ddd" : "#333" }]}>
                  {f === "all" ? "All" : f === "hot" ? "🔥 Hot" : f === "rare" ? "💎 Rare" : f === "lightning" ? "⚡ Lightning" : "🏷 Get Code"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {openPanel === "stores" && (
          <View style={[styles.panel, { backgroundColor: dark ? "#141414" : "#f7f7f7" }]}>
            {["all", ...storeOptions].map((s) => (
              <TouchableOpacity key={"store-" + s} onPress={() => { setStoreFilter(s); setOpenPanel(null); }}
                style={[styles.panelChip, { backgroundColor: storeFilter === s ? ACCENT : dark ? "#242424" : "#fff" }]}>
                <Text style={[styles.panelChipText, { color: storeFilter === s ? "#000" : dark ? "#ddd" : "#333" }]}>
                  {s === "all" ? "🏬 All Stores" : prettyStore(s)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {openPanel === "arrange" && (
          <View style={[styles.panel, { backgroundColor: dark ? "#141414" : "#f7f7f7" }]}>
            <Text style={[styles.panelLabel, { color: dark ? "#888" : "#999" }]}>Price</Text>
            {(PRICE_RANGES as unknown as typeof PRICE_RANGES[number][]).map((pr) => (
              <TouchableOpacity key={"price-" + pr.key} onPress={() => { setPriceRange(pr.key); }}
                style={[styles.panelChip, { backgroundColor: priceRange === pr.key ? ACCENT : dark ? "#242424" : "#fff" }]}>
                <Text style={[styles.panelChipText, { color: priceRange === pr.key ? "#000" : dark ? "#ddd" : "#333" }]}>{pr.label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.panelLabel, { color: dark ? "#888" : "#999", width: "100%" }]}>Sort</Text>
            {(SORT_OPTIONS as unknown as typeof SORT_OPTIONS[number][]).map((so) => (
              <TouchableOpacity key={so.key} onPress={() => { setSort(so.key); }}
                style={[styles.panelChip, { backgroundColor: sort === so.key ? ACCENT : dark ? "#242424" : "#fff" }]}>
                <Text style={[styles.panelChipText, { color: sort === so.key ? "#000" : dark ? "#ddd" : "#333" }]}>{so.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Results count */}
        <Text style={styles.resultsCount}>
          {isAdmin
            ? `${visibleDeals.length} deals`
            : !isPremium && visibleDeals.length >= FREE_DEAL_LIMIT
            ? "Upgrade to see 1000s of deals"
            : ""}
        </Text>
      </View>

      {/* ── DEAL LIST ── */}
      <FlatList
        ref={listRef}
        data={pagedDeals}
        key={gridMode ? "grid" : "list"}
        keyExtractor={(item) => item.id}
        numColumns={gridMode ? 2 : 1}
        contentContainerStyle={[styles.list, gridMode && styles.gridPadding]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (hasMore) setVisibleCount((c) => c + PAGE_SIZE);
        }}
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
          <View>
            {/* Load More button */}
            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                <Text style={styles.loadMoreText}>
                  Load More{isAdmin ? ` · ${visibleDeals.length - visibleCount} left` : ""}
                </Text>
                <Ionicons name="chevron-down" size={16} color={ACCENT} />
              </TouchableOpacity>
            )}

            {/* Premium upsell */}
            {!isPremium ? (
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
            ) : (
              <View style={{ height: 100 }} />
            )}
          </View>
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
  aiBtn: { paddingHorizontal: 4 },
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
  storeList: { marginBottom: 8 },
  tierToggle: { flexDirection: "row", gap: 8, marginBottom: 10 },
  dropRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dropBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderColor: "transparent", borderWidth: 1,
  },
  dropBtnText: { fontSize: 13, fontWeight: "700" },
  dropCaret: { fontSize: 12, marginLeft: 4 },
  panel: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    padding: 12, borderRadius: 12, marginBottom: 10,
  },
  panelChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  panelChipText: { fontSize: 13, fontWeight: "700" },
  panelLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginTop: 2, marginBottom: 2, width: "100%" },
  tierBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  tierBtnText: { fontSize: 13, fontWeight: "800" },
  storeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginRight: 6 },
  storeChipText: { fontSize: 11, fontWeight: "800" },
  priceList: { marginBottom: 8 },
  priceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginRight: 6 },
  priceChipText: { fontSize: 11, fontWeight: "800" },
  sortList: { marginBottom: 6 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: "#333", marginRight: 6 },
  sortText: { fontSize: 11, fontWeight: "700" },
  resultsCount: { fontSize: 10, color: "#666", marginBottom: 4, fontWeight: "600" },
  list: { paddingHorizontal: 8, paddingBottom: 40 },
  gridPadding: { paddingHorizontal: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { color: "#555", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptySub: { color: "#666", fontSize: 13 },
  loadMoreBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(255,122,0,0.08)",
    borderWidth: 1, borderColor: ACCENT + "44",
    borderRadius: 12, paddingVertical: 14, marginHorizontal: 12, marginTop: 6, marginBottom: 4,
  },
  loadMoreText: { color: ACCENT, fontSize: 13, fontWeight: "800" },
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