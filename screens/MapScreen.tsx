// flashradar/screens/MapScreen.tsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  StyleSheet, Dimensions, ActivityIndicator, View,
  TouchableOpacity, Animated, Text, FlatList,
  PanResponder, Linking, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region, Circle } from "react-native-maps";
import * as Location from "expo-location";
import { db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";

const { width: SW, height: SH } = Dimensions.get("window");
const ACCENT = "#FF7A00";

const SHEET_COLLAPSED = SH * 0.15;
const SHEET_HALF      = SH * 0.45;
const SHEET_FULL      = SH * 0.82;

// Stores that require premium
const PREMIUM_STORES = ["amazon", "costco", "bestbuy", "samsclub", "lowes"];

/* ─── Types ──────────────────────────────────────────────────── */

type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
  price: number;
  latitude: number;
  longitude: number;
  address?: string;
  rare?: boolean;
  hot?: boolean;
  lightning?: boolean;
  category?: string;
  discountPercent?: number | null;
  affiliateUrl?: string | null;
  merchantUrl?: string | null;
  url?: string | null;
  timestamp?: any;
};

/* ─── Category filters ───────────────────────────────────────── */

const CATEGORIES = [
  { key: "All",         label: "All 💰" },
  { key: "Electronics", label: "💻 Electronics" },
  { key: "Grocery",     label: "🛒 Grocery" },
  { key: "Clothing",    label: "👕 Clothing" },
  { key: "Auto",        label: "🚗 Auto" },
  { key: "Other",       label: "🧩 Other" },
];

/* ─── Store icons ────────────────────────────────────────────── */

function getStoreEmoji(storeKey?: string): string {
  switch ((storeKey || "").toLowerCase()) {
    case "walmart":   return "🛒";
    case "target":    return "🎯";
    case "amazon":    return "📦";
    case "homedepot": return "🔨";
    case "bestbuy":   return "💻";
    case "costco":    return "🏪";
    case "samsclub":  return "🏬";
    case "lowes":     return "🔧";
    case "nike":      return "👟";
    case "sephora":   return "💄";
    default:          return "🏷️";
  }
}

/* ─── Radar pulse ────────────────────────────────────────────── */

function RadarPulse({ coordinate }: { coordinate: { latitude: number; longitude: number } }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const radius = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 600] });
  const opacity = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] });

  return (
    <>
      {/* Static circle */}
      <Circle
        center={coordinate}
        radius={300}
        fillColor="rgba(255,122,0,0.06)"
        strokeColor="rgba(255,122,0,0.25)"
        strokeWidth={1}
      />
    </>
  );
}

/* ─── Custom Marker ──────────────────────────────────────────── */

function DealMarker({ deal, selected, onPress, isPremium }: {
  deal: Deal; selected: boolean; onPress: () => void; isPremium: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected) {
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true }).start();
    } else {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [selected]);

  // Flash animation for lightning deals
  useEffect(() => {
    if (deal.lightning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [deal.lightning]);

  const isLocked = PREMIUM_STORES.includes((deal.storeKey || "").toLowerCase()) && !isPremium;
  const color = deal.lightning ? "#facc15" : deal.rare ? "#a855f7" : deal.hot ? "#ef4444" : ACCENT;
  const emoji = getStoreEmoji(deal.storeKey || deal.store);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[
        marker.wrap,
        { borderColor: isLocked ? "#444" : color, backgroundColor: selected ? color : "#0f0f0f" },
        { transform: [{ scale: scaleAnim }] },
        deal.lightning && { opacity: flashAnim },
      ]}>
        {isLocked ? (
          <Text style={marker.lock}>🔒</Text>
        ) : (
          <Text style={[marker.price, { color: selected ? "#000" : color }]}>
            {emoji} ${Math.round(deal.price)}
          </Text>
        )}
        {deal.lightning && !isLocked && (
          <Text style={marker.lightning}>⚡</Text>
        )}
      </Animated.View>
      <View style={[marker.tail, { borderTopColor: isLocked ? "#444" : color }]} />
    </TouchableOpacity>
  );
}

const marker = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 2,
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
  },
  price: { fontSize: 11, fontWeight: "900" },
  lock: { fontSize: 11 },
  lightning: { fontSize: 8, position: "absolute", top: -6, right: -6 },
  tail: {
    width: 0, height: 0, alignSelf: "center",
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
});

/* ─── Deal Row ───────────────────────────────────────────────── */

function DealRow({ deal, onPress, onOpen, dark, isPremium }: {
  deal: Deal; onPress: () => void; onOpen: () => void; dark: boolean; isPremium: boolean;
}) {
  const isLocked = PREMIUM_STORES.includes((deal.storeKey || "").toLowerCase()) && !isPremium;
  const color = deal.lightning ? "#facc15" : deal.rare ? "#a855f7" : deal.hot ? "#ef4444" : ACCENT;
  const emoji = getStoreEmoji(deal.storeKey || deal.store);

  return (
    <TouchableOpacity
      onPress={isLocked ? undefined : onPress}
      style={[row.card, { backgroundColor: dark ? "#111" : "#f9f9f9", opacity: isLocked ? 0.6 : 1 }]}
      activeOpacity={0.85}
    >
      <View style={[row.bar, { backgroundColor: isLocked ? "#444" : color }]} />
      <View style={row.content}>
        <View style={row.topRow}>
          <Text style={[row.store, { color: dark ? "#888" : "#999" }]}>
            {emoji} {(deal.store || "").toUpperCase()}
          </Text>
          {deal.lightning && <View style={[row.badge, { backgroundColor: "#ca8a04" }]}><Text style={row.badgeTxt}>⚡ LIGHTNING</Text></View>}
          {deal.rare && !deal.lightning && <View style={[row.badge, { backgroundColor: "#9333ea" }]}><Text style={row.badgeTxt}>💎 RARE</Text></View>}
          {deal.hot && !deal.rare && !deal.lightning && <View style={[row.badge, { backgroundColor: "#ef4444" }]}><Text style={row.badgeTxt}>🔥 HOT</Text></View>}
          {isLocked && <View style={[row.badge, { backgroundColor: "#333" }]}><Text style={row.badgeTxt}>🔒 PREMIUM</Text></View>}
        </View>
        <Text style={[row.title, { color: isLocked ? "#555" : dark ? "#f4f4f5" : "#111" }]} numberOfLines={1}>
          {isLocked ? "Upgrade to unlock this deal" : deal.title}
        </Text>
        <View style={row.bottomRow}>
          {!isLocked && <Text style={row.price}>${Number(deal.price).toFixed(2)}</Text>}
          {!isLocked && (deal.discountPercent ?? 0) > 0 && (
            <Text style={row.disc}>-{deal.discountPercent}%</Text>
          )}
          {deal.address && !isLocked && (
            <Text style={row.addr} numberOfLines={1}>📍 {deal.address}</Text>
          )}
        </View>
      </View>

      {isLocked ? (
        <View style={[row.btn, { backgroundColor: "#333" }]}>
          <Text style={row.btnTxt}>PRO</Text>
        </View>
      ) : (
        <TouchableOpacity style={row.btn} onPress={onOpen}>
          <Text style={row.btnTxt}>GO</Text>
          <Ionicons name="arrow-forward" size={12} color="#000" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, marginHorizontal: 12, marginBottom: 8,
    overflow: "hidden",
  },
  bar: { width: 4, alignSelf: "stretch" },
  content: { flex: 1, padding: 10 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" },
  store: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  badge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  badgeTxt: { color: "#fff", fontSize: 7, fontWeight: "900" },
  title: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  price: { fontSize: 15, fontWeight: "900", color: ACCENT },
  disc: { fontSize: 10, fontWeight: "800", color: "#22c55e" },
  addr: { fontSize: 10, color: "#888", flex: 1 },
  btn: {
    backgroundColor: ACCENT, margin: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, alignItems: "center", gap: 2,
  },
  btnTxt: { color: "#000", fontWeight: "900", fontSize: 10 },
});

/* ─── Main Screen ────────────────────────────────────────────── */

export default function MapScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchArea, setSearchArea] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

  const mapRef = useRef<MapView>(null);
  const { theme, colors } = useTheme();
  const { isPremium } = useUser();
  const dark = theme === "dark";

  // Bottom sheet animation
  const sheetY = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const lastSheetY = useRef(SHEET_COLLAPSED);
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { sheetY.stopAnimation(); },
      onPanResponderMove: (_, g) => {
        const newY = lastSheetY.current - g.dy;
        const clamped = Math.max(SHEET_COLLAPSED, Math.min(SHEET_FULL, newY));
        sheetY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const newY = lastSheetY.current - g.dy;
        let snap = SHEET_COLLAPSED;
        if (newY > (SHEET_HALF + SHEET_FULL) / 2) snap = SHEET_FULL;
        else if (newY > (SHEET_COLLAPSED + SHEET_HALF) / 2) snap = SHEET_HALF;
        Animated.spring(sheetY, { toValue: snap, useNativeDriver: false, tension: 60, friction: 10 }).start();
        lastSheetY.current = snap;
      },
    })
  ).current;

  const snapSheet = (to: number) => {
    Animated.spring(sheetY, { toValue: to, useNativeDriver: false, tension: 60, friction: 10 }).start();
    lastSheetY.current = to;
  };

  /* ── Real-time listener + location ── */
  useEffect(() => {
    // Real-time Firestore listener
    const unsubscribe = db.collection("deals_live")
      .onSnapshot((snap) => {
        const items: Deal[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Deal, "id">) }))
          .filter((d) => typeof d.latitude === "number" && typeof d.longitude === "number");
        setDeals(items);
        setLoading(false);
      }, (err) => {
        console.error("[MapScreen] listener error:", err);
        setLoading(false);
      });

    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      const r = { latitude, longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
      setRegion(r);
      setCurrentRegion(r);
    };

    loadLocation();
    return () => unsubscribe();
  }, []);

  /* ── Filtered deals ── */
  const filteredDeals = useMemo(() => {
    let list = deals;
    if (selectedCategory !== "All") {
      list = list.filter((d) => d.category === selectedCategory);
    }
    return list;
  }, [deals, selectedCategory]);

  /* ── Counts ── */
  const premiumCount = filteredDeals.filter(d =>
    PREMIUM_STORES.includes((d.storeKey || "").toLowerCase())
  ).length;

  /* ── Marker press ── */
  const handleMarkerPress = (deal: Deal) => {
    setSelectedId(deal.id);
    mapRef.current?.animateToRegion({
      latitude: deal.latitude - 0.003,
      longitude: deal.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 400);
    snapSheet(SHEET_HALF);
  };

  /* ── Open deal URL ── */
  const openDeal = (deal: Deal) => {
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (url) Linking.openURL(url);
    else if (deal.address) {
      const q = encodeURIComponent(deal.address);
      const mapsUrl = Platform.select({
        ios: `maps://?q=${q}`,
        android: `geo:0,0?q=${q}`,
      });
      if (mapsUrl) Linking.openURL(mapsUrl);
    }
  };

  /* ── Search this area ── */
  const searchThisArea = async () => {
    if (!currentRegion) return;
    setSearchArea(false);
  };

  /* ── Recenter ── */
  const recenter = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }, 500);
  };

  const selectedDeal = filteredDeals.find((d) => d.id === selectedId);
  const sheetDeals = selectedDeal
    ? [selectedDeal, ...filteredDeals.filter((d) => d.id !== selectedId)]
    : filteredDeals;

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Locating deals near you...</Text>
        </View>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="location-outline" size={40} color="#666" />
          <Text style={[styles.loadingText, { marginTop: 10 }]}>
            Location access needed to show nearby deals
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {/* ── MAP ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={dark ? darkMapStyle : []}
        showsUserLocation={false}
        onRegionChange={(r) => {
          setCurrentRegion(r);
          setSearchArea(true);
        }}
        onPress={() => {
          setSelectedId(null);
          snapSheet(SHEET_COLLAPSED);
        }}
      >
        {/* User location with radar pulse */}
        {userLocation && (
          <>
            <RadarPulse coordinate={userLocation} />
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userDot}>
                <View style={styles.userDotInner} />
              </View>
            </Marker>
          </>
        )}

        {/* Deal markers */}
        {filteredDeals.map((deal) => (
          <Marker
            key={deal.id}
            coordinate={{ latitude: deal.latitude, longitude: deal.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => handleMarkerPress(deal)}
          >
            <DealMarker
              deal={deal}
              selected={selectedId === deal.id}
              onPress={() => handleMarkerPress(deal)}
              isPremium={isPremium}
            />
          </Marker>
        ))}
      </MapView>

      {/* ── CATEGORY FILTER CHIPS ── */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setSelectedCategory(cat.key)}
              style={[
                styles.chip,
                { backgroundColor: selectedCategory === cat.key ? ACCENT : "rgba(0,0,0,0.75)" },
              ]}
            >
              <Text style={[
                styles.chipText,
                { color: selectedCategory === cat.key ? "#000" : "#fff" },
              ]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Premium locked banner */}
        {!isPremium && premiumCount > 0 && (
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumBannerText}>
              🔒 {premiumCount} premium deals hidden — Upgrade to unlock
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── SEARCH THIS AREA ── */}
      {searchArea && (
        <TouchableOpacity style={styles.searchAreaBtn} onPress={searchThisArea}>
          <Ionicons name="search-outline" size={14} color="#fff" />
          <Text style={styles.searchAreaText}>Search this area</Text>
        </TouchableOpacity>
      )}

      {/* ── RECENTER ── */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
        <Ionicons name="locate-outline" size={20} color={ACCENT} />
      </TouchableOpacity>

      {/* ── DEAL COUNT PILL ── */}
      <View style={styles.countPill}>
        <View style={styles.countDot} />
        <Text style={styles.countText}>{filteredDeals.length} deals nearby</Text>
      </View>

      {/* ── BOTTOM SHEET ── */}
      <Animated.View style={[styles.sheet, { height: sheetY }]}>
        <View {...sheetPanResponder.panHandlers} style={styles.handleWrap}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: dark ? "#fff" : "#111" }]}>
              {selectedDeal ? selectedDeal.store : `${filteredDeals.length} Deals Near You`}
            </Text>
            <View style={styles.sheetSnapBtns}>
              <TouchableOpacity onPress={() => snapSheet(SHEET_HALF)}>
                <Ionicons name="remove-outline" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => snapSheet(SHEET_FULL)}>
                <Ionicons name="chevron-up-outline" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <FlatList
          data={sheetDeals}
          keyExtractor={(d) => d.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptySheet}>
              <Ionicons name="map-outline" size={36} color="#444" />
              <Text style={styles.emptySheetText}>No deals in this area</Text>
              <Text style={styles.emptySheetSub}>Move the map to explore other zones</Text>
            </View>
          }
          renderItem={({ item }) => (
            <DealRow
              deal={item}
              dark={dark}
              isPremium={isPremium}
              onPress={() => {
                handleMarkerPress(item);
                mapRef.current?.animateToRegion({
                  latitude: item.latitude,
                  longitude: item.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 500);
              }}
              onOpen={() => openDeal(item)}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  map: { width: SW, height: SH },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  loadingText: { color: "#888", marginTop: 12, fontWeight: "600", textAlign: "center" },

  userDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(255,122,0,0.3)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1.5, borderColor: ACCENT,
  },
  userDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },

  topOverlay: { position: "absolute", top: 0, left: 0, right: 0 },
  chipRow: { paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
  },
  chipText: { fontSize: 12, fontWeight: "800" },

  premiumBanner: {
    marginHorizontal: 12, marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,122,0,0.3)",
  },
  premiumBannerText: { color: ACCENT, fontSize: 11, fontWeight: "800", textAlign: "center" },

  searchAreaBtn: {
    position: "absolute", top: SH * 0.18, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
    borderWidth: 1, borderColor: ACCENT + "55",
    shadowColor: "#000", shadowRadius: 6, shadowOpacity: 0.4, elevation: 6,
  },
  searchAreaText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  recenterBtn: {
    position: "absolute", right: 16, bottom: SHEET_COLLAPSED + 20,
    backgroundColor: "#1a1a1a", padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000", shadowRadius: 6, shadowOpacity: 0.4, elevation: 6,
  },

  countPill: {
    position: "absolute", left: 16, bottom: SHEET_COLLAPSED + 20,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,122,0,0.3)",
  },
  countDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ACCENT },
  countText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: "rgba(255,122,0,0.2)",
    shadowColor: "#000", shadowRadius: 20, shadowOpacity: 0.5, elevation: 20,
  },
  handleWrap: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 4 },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#333", alignSelf: "center", marginBottom: 10,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 16, fontWeight: "900" },
  sheetSnapBtns: { flexDirection: "row", gap: 8, alignItems: "center" },

  emptySheet: { alignItems: "center", paddingVertical: 30, gap: 6 },
  emptySheetText: { color: "#555", fontWeight: "900", fontSize: 15 },
  emptySheetSub: { color: "#444", fontSize: 12 },
});

/* ─── Dark map style ─────────────────────────────────────────── */

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f0f0f" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#555" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f0f0f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#FF7A0022" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#222" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#111" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];