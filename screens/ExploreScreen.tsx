// flashradar/screens/ExploreScreen.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

/* ───────────────────── TYPES ───────────────────── */

export type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;

  // optional price history inputs
  originalPrice?: number | null;
  avg30?: number | null;
  avg60?: number | null;
  avg90?: number | null;

  // optional precomputed discount (if you add it later in merge/ingest)
  discountPercent?: number | null;

  url?: string | null;
  merchantUrl?: string | null;
  affiliateUrl?: string | null;

  image?: string | null;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;

  createdAt?: any;
};

/* ───────────────────── CONSTANTS ───────────────────── */

const FREE_STORES = ["walmart", "target", "homedepot"];
const FILTERS = ["all", "hot", "rare", "lightning"] as const;
type FilterType = (typeof FILTERS)[number];

const normalizeStore = (s: string) =>
  s.toLowerCase().replace(".com", "").replace(/\s+/g, "");

/* ───────────────────── HELPERS ───────────────────── */

/**
 * Returns:
 * - number (0..100) if we can compute (or if discountPercent exists)
 * - null if we cannot compute yet (no history/old price data)
 */
function computeDiscountPercent(d: Deal): number | null {
  // If your backend starts writing discountPercent, use it.
  if (typeof d.discountPercent === "number" && isFinite(d.discountPercent)) {
    return Math.max(0, Math.round(d.discountPercent));
  }

  if (typeof d.price !== "number" || d.price <= 0) return null;

  const candidates = [d.originalPrice, d.avg30, d.avg60, d.avg90].filter(
    (p): p is number => typeof p === "number" && p > d.price
  );

  if (!candidates.length) return null;

  const oldPrice = Math.max(...candidates);
  const pct = ((oldPrice - d.price) / oldPrice) * 100;
  return Math.max(0, Math.round(pct));
}

/* ───────────────────── SCREEN ───────────────────── */

export default function ExploreScreen() {
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const listRef = useRef<FlatList>(null);

  const { user } = useAuth();
  const { theme, colors } = useTheme();
  const isDark = theme === "dark";

  const navigation = useNavigation<any>();

  /* ───────── LOAD PREMIUM FLAG ───────── */

  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) =>
      setIsPremium(!!snap.data()?.isPremium)
    );

    return unsub;
  }, [user?.uid]);

  /* ───────── LOAD DEALS ───────── */
useEffect(() => {
  const q = query(
    collection(db, "deals_online"),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(q, (snap) => {
    const rows: Deal[] = snap.docs.map((d) => {
      const data = d.data() as any;

      return {
        id: d.id,
        title: data.title ?? "Deal",
        store: data.store ?? "online",
        price: Number(data.price ?? 0),

        originalPrice: data.originalPrice ?? null,
        avg30: data.avg30 ?? null,
        avg60: data.avg60 ?? null,
        avg90: data.avg90 ?? null,
        discountPercent: data.discountPercent ?? null,

        url: data.url ?? null,
        merchantUrl: data.merchantUrl ?? null,
        affiliateUrl: data.affiliateUrl ?? null,

        image: 
          data.imageUrl ?? 
          data.image ??
          data.Image ??
          null,
        hot: !!data.hot,
        rare: !!data.rare,
        lightning: !!data.lightning,
        live: data.live ?? null,
        createdAt: data.createdAt,
      };
    });

    setRawDeals(rows);
    setLoading(false);
  });

  return unsub;
}, []);

  /* ───────── FILTER + SEARCH + QUALITY ───────── */

  const visibleDeals = useMemo(() => {
    let list = rawDeals;

    // 🔒 Membership gate
    if (!isPremium) {
      list = list.filter((d) => FREE_STORES.includes(normalizeStore(d.store)));
    }

    // 🔍 Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) => d.title.toLowerCase().includes(q) || d.store.toLowerCase().includes(q)
      );
    }

    // ✅ Good deals filter (ONLY when we can compute a discount)
    // If we can't compute yet, we keep it (so your list doesn't go empty).
    list = list.filter((d) => {
      const pct = computeDiscountPercent(d);
      if (pct === null) return true; // keep unknown discount until history exists
      return pct >= 20;
    });

    // ⚡ Filter chips
    if (filter !== "all") {
      list = list.filter((d: any) => d[filter] === true);
    }

    return list;
  }, [rawDeals, isPremium, search, filter]);

  /* ───────── REFRESH ───────── */

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  /* ───────── LOADING ───────── */

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  /* ───────── UI ───────── */

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.headerWrap}>
        <Text style={[styles.title, { color: colors.text }]}>Explore Deals</Text>

        {/* SEARCH */}
        <View style={[styles.searchBox, { backgroundColor: isDark ? "#111" : "#eee" }]}>
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            placeholder="Search deals or stores"
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        {/* FILTERS */}
        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[
                styles.filterChip,
                filter === f && { backgroundColor: colors.accent },
              ]}
            >
              <Text style={[styles.filterText, filter === f && { color: "#fff" }]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* LIST */}
      <FlatList
        ref={listRef}
        data={visibleDeals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.text }]}>No deals found.</Text>
        }
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            darkMode={isDark}
            onPress={() => navigation.navigate("DealDetail", { deal: item })}
          />
        )}
      />

      {/* BACK TO TOP */}
      <TouchableOpacity
        style={styles.backToTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
      >
        <Ionicons name="arrow-up" size={20} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

/* ───────────────────── STYLES ───────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerWrap: { padding: 16 },
  title: { fontSize: 26, fontWeight: "900", marginBottom: 8 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },

  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#333",
  },
  filterText: { fontSize: 11, fontWeight: "800", color: "#ccc" },

  list: { paddingHorizontal: 12, paddingBottom: 140 },

  backToTop: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#FF6600",
    padding: 12,
    borderRadius: 999,
  },

  empty: { textAlign: "center", marginTop: 40, fontSize: 16 },
});
