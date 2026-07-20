// flashradar/screens/RadarScreen.tsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, Animated,
  TouchableOpacity, Linking, Easing, Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";
import { useUser } from "../context/UserContext";
import DealCard from "../components/DealCard";

/* ─── Constants ──────────────────────────────────────────────── */

const ACCENT = "#FF7A00";
const { width: SW } = Dimensions.get("window");
const FREE_LIMIT = 5;
const QUERY_LIMIT = 80;

/* ─── Types ──────────────────────────────────────────────────── */

type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  affiliateUrl?: string | null;
  merchantUrl?: string | null;
  url?: string | null;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;
  isSaved?: boolean;
  dealScore?: number | null;
  asin?: string | null;
  publishedAt?: any;
  createdAt?: any;
  latitude?: number | null;
  longitude?: number | null;
  couponCode?: string | null;
  resaleIntel?: {
    profitPotential: number;
    roiPercent: number;
    demandLevel: string;
  } | null;
};

/* ─── Radar Ring Animation ───────────────────────────────────── */

function RadarScanner() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1, duration: 2400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();

    pulse(ring1, 0);
    pulse(ring2, 800);
    pulse(ring3, 1600);

    Animated.loop(
      Animated.timing(sweep, {
        toValue: 1, duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const ringStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.8, 0.4, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
  });

  const sweepRotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={radar.container}>
      {/* Rings */}
      {[ring1, ring2, ring3].map((r, i) => (
        <Animated.View key={i} style={[radar.ring, ringStyle(r)]} />
      ))}

      {/* Grid lines */}
      <View style={[radar.crosshair, { transform: [{ rotate: "0deg" }] }]} />
      <View style={[radar.crosshair, { transform: [{ rotate: "90deg" }] }]} />
      <View style={[radar.crosshair, { transform: [{ rotate: "45deg" }] }]} />
      <View style={[radar.crosshair, { transform: [{ rotate: "135deg" }] }]} />

      {/* Sweep arm */}
      <Animated.View
        style={[radar.sweep, { transform: [{ rotate: sweepRotate }] }]}
      />

      {/* Center dot */}
      <View style={radar.center}>
        <View style={radar.centerDot} />
      </View>

      {/* Random deal pings */}
      {PING_POSITIONS.map((p, i) => (
        <PingDot key={i} x={p.x} y={p.y} delay={p.delay} color={p.color} />
      ))}
    </View>
  );
}

const PING_POSITIONS = [
  { x: 30, y: 40, delay: 400, color: ACCENT },
  { x: 65, y: 25, delay: 1200, color: "#ef4444" },
  { x: 75, y: 60, delay: 2000, color: "#a855f7" },
  { x: 20, y: 65, delay: 700, color: ACCENT },
  { x: 50, y: 75, delay: 1800, color: "#22c55e" },
  { x: 80, y: 80, delay: 300, color: "#ef4444" },
];

function PingDot({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(1000),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[
      radar.ping,
      {
        left: `${x}%`, top: `${y}%`,
        backgroundColor: color,
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.4, 1] }) }],
      },
    ]} />
  );
}

const RADAR_SIZE = SW * 0.72;

const radar = StyleSheet.create({
  container: {
    width: RADAR_SIZE, height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5, borderColor: ACCENT + "44",
    alignSelf: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,122,0,0.03)",
    justifyContent: "center", alignItems: "center",
    marginVertical: 16,
  },
  ring: {
    position: "absolute",
    width: RADAR_SIZE, height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5, borderColor: ACCENT + "66",
  },
  crosshair: {
    position: "absolute",
    width: RADAR_SIZE, height: 1,
    backgroundColor: ACCENT + "22",
  },
  sweep: {
    position: "absolute",
    width: RADAR_SIZE / 2, height: 2,
    left: "50%", top: "50%",
    backgroundColor: "transparent",
    transformOrigin: "left center",
    borderTopWidth: 1,
    borderTopColor: ACCENT,
    shadowColor: ACCENT,
    shadowRadius: 6,
    shadowOpacity: 0.8,
  },
  center: {
    position: "absolute",
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: ACCENT + "33",
    justifyContent: "center", alignItems: "center",
  },
  centerDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT,
  },
  ping: {
    position: "absolute",
    width: 8, height: 8, borderRadius: 4,
    shadowRadius: 6, shadowOpacity: 0.9,
  },
});

/* ─── Stat Pills ─────────────────────────────────────────────── */

function StatPill({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: number | string; color: string;
}) {
  return (
    <View style={[pill.wrap, { borderColor: color + "44", backgroundColor: color + "11" }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[pill.value, { color }]}>{value}</Text>
      <Text style={pill.label}>{label}</Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrap: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, marginRight: 8,
  },
  value: { fontWeight: "900", fontSize: 13 },
  label: { fontSize: 11, color: "#888", fontWeight: "600" },
});

/* ─── Deal Ping Card (compact urgent card) ───────────────────── */

function PingCard({ deal, onPress, onOpen, dark, t }: {
  deal: Deal; onPress: () => void; onOpen: () => void; dark: boolean; t: any;
}) {
  const isJustIn = (() => {
    const ms = deal.publishedAt?.seconds
      ? deal.publishedAt.seconds * 1000
      : deal.createdAt?.seconds ? deal.createdAt.seconds * 1000 : 0;
    return ms > 0 && Date.now() - ms < 1_800_000;
  })();

  const flipProfit = deal.resaleIntel?.profitPotential ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        ping.card,
        deal.rare && { borderColor: "#a855f7" },
        deal.hot && { borderColor: "#ef4444" },
        { backgroundColor: dark ? "#0f0f0f" : "#fff" },
      ]}
      activeOpacity={0.85}
    >
      {/* Left: store + title + price */}
      <View style={ping.left}>
        <View style={ping.topRow}>
          {isJustIn && (
            <View style={[ping.badge, { backgroundColor: "#2563eb" }]}>
              <Ionicons name="flash" size={8} color="#fff" />
              <Text style={ping.badgeTxt}>JUST IN</Text>
            </View>
          )}
          {deal.rare && (
            <View style={[ping.badge, { backgroundColor: "#9333ea" }]}>
              <Text style={ping.badgeTxt}>💎 RARE</Text>
            </View>
          )}
          {deal.hot && !deal.rare && (
            <View style={[ping.badge, { backgroundColor: "#ea580c" }]}>
              <Text style={ping.badgeTxt}>🔥 HOT</Text>
            </View>
          )}
          <Text style={[ping.store, { color: dark ? "#888" : "#999" }]}>
            {(deal.store || "").toUpperCase()}
          </Text>
        </View>

        <Text style={[ping.title, { color: dark ? "#f4f4f5" : "#111" }]} numberOfLines={2}>
          {deal.title}
        </Text>

        <View style={ping.priceRow}>
          <Text style={ping.price}>
            {deal.price != null ? `$${Number(deal.price).toFixed(2)}` : "—"}
          </Text>
          {(deal.discountPercent ?? 0) > 0 && (
            <View style={ping.discBadge}>
              <Text style={ping.discText}>-{deal.discountPercent}%</Text>
            </View>
          )}
          {deal.originalPrice != null && deal.price != null && deal.originalPrice > deal.price && (
            <Text style={ping.original}>${Number(deal.originalPrice).toFixed(2)}</Text>
          )}
        </View>

        {/* Flip Intel */}
        {flipProfit > 0 && (
          <View style={ping.flipRow}>
            <Ionicons name="trending-up-outline" size={11} color="#22c55e" />
            <Text style={ping.flipTxt}>
              Flip +${flipProfit} · {deal.resaleIntel!.roiPercent}% ROI
            </Text>
          </View>
        )}
      </View>

      {/* Right: Grab Deal */}
      <TouchableOpacity style={ping.grabBtn} onPress={onOpen}>
        <Text style={ping.grabTxt}>{t.radar.grab}</Text>
        <Ionicons name="arrow-forward" size={12} color="#000" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const ping = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    padding: 12, marginBottom: 8, gap: 10,
  },
  left: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  badgeTxt: { color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.3 },
  store: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 18, marginBottom: 5 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  price: { fontSize: 17, fontWeight: "900", color: ACCENT },
  discBadge: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  discText: { fontSize: 9, fontWeight: "900", color: "#22c55e" },
  original: { fontSize: 10, color: "#666", textDecorationLine: "line-through" },
  flipRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  flipTxt: { fontSize: 10, color: "#22c55e", fontWeight: "700" },
  grabBtn: {
    backgroundColor: ACCENT, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, alignItems: "center", gap: 2,
  },
  grabTxt: { color: "#000", fontWeight: "900", fontSize: 10 },
});

/* ─── Main Screen ────────────────────────────────────────────── */

export default function RadarScreen() {
  const { language } = useLanguage();
  const t = getStrings(language);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"hot" | "rare" | "flip" | "all">("hot");

  const navigation = useNavigation<any>();
  const { theme, colors } = useTheme();
  const dark = theme === "dark";
  const { isPremium } = useUser();
  const listRef = useRef<FlatList>(null);

  // Scanning pulse for header
  const scanPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(scanPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  /* ── Location ── */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  /* ── Load deals from all collections ── */
  useEffect(() => {
    const results: Record<string, Deal> = {};
    let resolved = 0;
    const COLS = ["deals_live"];

    // Simulate radar scanning delay for UX effect
    setTimeout(() => setScanning(false), 2200);

    const unsubs = COLS.map((col) =>
      db.collection(col)
        .orderBy("createdAt", "desc")
        .limit(QUERY_LIMIT)
        .onSnapshot(
          (snap) => {
            snap.docs.forEach((d) => {
              if (!results[d.id]) {
                const data = d.data() as any;
                results[d.id] = {
                  id: d.id,
                  title: data.title ?? "Deal",
                  store: data.store ?? data.storeKey ?? "Retailer",
                  storeKey: data.storeKey ?? null,
                  price: Number(data.price ?? 0),
                  originalPrice: data.originalPrice ?? null,
                  discountPercent: data.discountPercent ?? null,
                  image: data.imageUrl ?? data.image ?? null,
                  imageUrl: data.imageUrl ?? data.image ?? null,
                  affiliateUrl: data.affiliateUrl ?? null,
                  merchantUrl: data.merchantUrl ?? null,
                  url: data.url ?? null,
                  hot: !!data.hot,
                  rare: !!data.rare,
                  lightning: !!data.lightning,
                  live: data.live ?? true,
                  dealScore: data.dealScore ?? null,
                  asin: data.asin ?? null,
                  publishedAt: data.publishedAt ?? null,
                  createdAt: data.createdAt ?? null,
                  latitude: data.latitude ?? null,
                  longitude: data.longitude ?? null,
                  couponCode: data.couponCode ?? null,
                  resaleIntel: data.resaleIntel ?? null,
                };
              }
            });
            resolved++;
            if (resolved >= COLS.length) {
              setDeals(Object.values(results).sort((a, b) =>
                (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
              ));
              setLoading(false);
            }
          },
          () => { resolved++; if (resolved >= COLS.length) setLoading(false); }
        )
    );

    return () => unsubs.forEach((u) => u());
  }, []);

  /* ── Stats ── */
  const stats = useMemo(() => ({
    hot: deals.filter((d) => d.hot || (d.discountPercent ?? 0) >= 30).length,
    rare: deals.filter((d) => d.rare || (d.discountPercent ?? 0) >= 50).length,
    flip: deals.filter((d) =>
      (d.resaleIntel?.profitPotential ?? 0) > 20 ||
      (d.discountPercent ?? 0) >= 40
   ).length, 
  }), [deals]);
  

  /* ── Filtered deals by tab ── */
  const tabDeals = useMemo(() => {
    let list = deals;
    if (activeTab === "hot") list = deals.filter((d) => d.hot || (d.discountPercent ?? 0) > 30);
    else if (activeTab === "rare") list = deals.filter((d) => d.rare);
    else if (activeTab === "flip") list = deals.filter((d) => (d.resaleIntel?.profitPotential ?? 0) > 0);
    if (!isPremium) list = list.slice(0, FREE_LIMIT);
    return list;
  }, [deals, activeTab, isPremium]);

  const openDeal = (deal: Deal) => {
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (url) Linking.openURL(url);
  };

  /* ── Scanning state ── */
  if (scanning || loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.scanningWrap}>
          <View style={styles.scanningHeader}>
            <Animated.View style={{ transform: [{ scale: scanPulse }] }}>
              <Ionicons name="radio-outline" size={24} color={ACCENT} />
            </Animated.View>
            <Text style={styles.scanningText}>SCANNING RADAR...</Text>
          </View>
          <RadarScanner />
          <Text style={styles.scanningSubtext}>
            Detecting live deals near you
          </Text>
          {location && (
            <Text style={styles.locationText}>
              📍 Location locked
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={tabDeals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Radar Header ── */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.radarIcon}>
                  <Ionicons name="radio-outline" size={20} color={ACCENT} />
                  <Animated.View style={[styles.liveDot, { transform: [{ scale: scanPulse }] }]} />
                </View>
                <View>
                  <Text style={[styles.headerTitle, { color: dark ? "#fff" : "#111" }]}>
                    DEAL RADAR
                  </Text>
                  <Text style={styles.headerSub}>
                    {isPremium ? "⚡ Premium · " : ""}{deals.length} live hits detected
                  </Text>
                </View>
              </View>
              {location && (
                <View style={styles.locationBadge}>
                  <Ionicons name="location-outline" size={11} color={ACCENT} />
                  <Text style={styles.locationBadgeText}>{t.radar.locationOn}</Text>
                </View>
              )}
            </View>

            {/* ── Radar Scanner ── */}
            <RadarScanner />

            {/* ── Stat Pills ── */}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={[
                { icon: "flame-outline" as const, label: "Hot", value: stats.hot, color: "#ef4444" },
                { icon: "diamond-outline" as const, label: "Rare", value: stats.rare, color: "#a855f7" },
                { icon: "trending-up-outline" as const, label: "Flippable", value: stats.flip, color: "#22c55e" },
                { icon: "storefront-outline" as const, label: "Stores", value: new Set(deals.map(d => d.store)).size, color: ACCENT },
              ]}
              keyExtractor={(s) => s.label}
              contentContainerStyle={styles.pillRow}
              renderItem={({ item: s }) => (
                <StatPill icon={s.icon} label={s.label} value={s.value} color={s.color} />
              )}
            />

            {/* ── Tab Selector ── */}
            <View style={styles.tabRow}>
              {(["hot", "rare", "flip", "all"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tab,
                    activeTab === tab && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === tab ? "#000" : dark ? "#888" : "#666" },
                  ]}>
                    {tab === "hot" ? "🔥 HOT" : tab === "rare" ? "💎 RARE" : tab === "flip" ? "📈 FLIP" : "ALL"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tabDeals.length > 0 && (
              <Text style={styles.resultsLabel}>
                {tabDeals.length} signal{tabDeals.length !== 1 ? "s" : ""} detected
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wifi-outline" size={40} color="#444" />
            <Text style={styles.emptyTitle}>{t.radar.silence}</Text>
            <Text style={styles.emptySub}>{t.radar.noSignals}</Text>
          </View>
        }
        ListFooterComponent={
          !isPremium && deals.length > FREE_LIMIT ? (
            <TouchableOpacity
              style={styles.unlockBox}
              onPress={() => navigation.navigate("Upgrade")}
            >
              <Ionicons name="lock-closed-outline" size={18} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.unlockTitle}>{t.radar.eliteFrequencies}</Text>
                <Text style={styles.unlockSub}>
                  Upgrade to unlock {deals.length - FREE_LIMIT}+ more signals
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </TouchableOpacity>
          ) : <View style={{ height: 80 }} />
        }
        renderItem={({ item }) => (
          <PingCard
            deal={item}
            dark={dark}
            t={t}
            onPress={() => navigation.navigate("DealDetail", { deal: item })}
            onOpen={() => openDeal(item)}
          />
        )}
      />
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { paddingHorizontal: 12, paddingBottom: 40 },

  // Scanning
  scanningWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  scanningHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  scanningText: { color: ACCENT, fontWeight: "900", fontSize: 16, letterSpacing: 1.5 },
  scanningSubtext: { color: "#666", fontSize: 13, marginTop: 8, fontWeight: "600" },
  locationText: { color: "#22c55e", fontSize: 12, marginTop: 6, fontWeight: "700" },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 4, paddingTop: 4,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  radarIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: ACCENT + "18",
    justifyContent: "center", alignItems: "center", position: "relative",
  },
  liveDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  headerSub: { fontSize: 11, color: "#888", marginTop: 1, fontWeight: "600" },
  locationBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: ACCENT + "18", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  locationBadgeText: { fontSize: 10, color: ACCENT, fontWeight: "800" },

  // Pills
  pillRow: { paddingBottom: 12 },

  // Tabs
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: "#333",
  },
  tabText: { fontSize: 11, fontWeight: "900" },
  resultsLabel: { fontSize: 11, color: "#666", fontWeight: "700", marginBottom: 8 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { color: "#555", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  emptySub: { color: "#666", fontSize: 13 },

  // Unlock
  unlockBox: {
    backgroundColor: "#111", borderWidth: 1, borderColor: ACCENT + "33",
    padding: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8,
  },
  unlockTitle: { color: "#fff", fontWeight: "900", fontSize: 14 },
  unlockSub: { color: "#888", fontSize: 12, marginTop: 2 },
});