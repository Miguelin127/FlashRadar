// flashradar/screens/MapScreen.tsx

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  StyleSheet, Dimensions, ActivityIndicator, View,
  TouchableOpacity, Animated, Text, FlatList, Image,
  PanResponder, Linking, Platform, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Region, Circle } from "react-native-maps";
import * as Location from "expo-location";
import { db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { isStoreLockedByName } from "../constants/premiumStores";
import { useUser } from "../context/UserContext";

const { width: SW, height: SH } = Dimensions.get("window");
const ACCENT = "#FF7A00";

const SHEET_COLLAPSED = SH * 0.15;
const SHEET_HALF      = SH * 0.45;
const SHEET_FULL      = SH * 0.82;

const GOOGLE_API_KEY = "AIzaSyBeldwLWhSlf0bYzJHBmtce4R1XoEnXBXc";

/* ─── Store config ───────────────────────────────────────────── */


const PREMIUM_STORE_NAMES = [
  "Best Buy", "Costco", "Sam's Club", "Lowe's",
  "Apple Store", "Nordstrom", "Bloomingdale's", "Neiman Marcus",
  "Saks Fifth Avenue", "TJ Maxx", "Marshalls", "Ross",
  "Burlington", "Nike", "Foot Locker", "GameStop",
  "Macy's", "Sephora",
];

const ALL_STORE_SEARCHES = [
  "Walmart", "Target", "Home Depot",
  ...PREMIUM_STORE_NAMES,
];

/* ─── Types ──────────────────────────────────────────────────── */

type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
  price: number;
  originalPrice?: number | null;
  latitude: number;
  longitude: number;
  address?: string;
  rare?: boolean;
  hot?: boolean;
  lightning?: boolean;
  category?: string;
  imageUrl?: string | null;
  discountPercent?: number | null;
  affiliateUrl?: string | null;
  merchantUrl?: string | null;
  url?: string | null;
};

type NearbyStore = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  isPremium: boolean;
  deals: Deal[];
};

/* ─── Category filters ───────────────────────────────────────── */

const CATEGORIES = [
  { key: "All",          label: "All 💰" },
  { key: "Electronics",  label: "💻 Electronics" },
  { key: "Grocery",      label: "🛒 Grocery" },
  { key: "Clothing",     label: "👕 Clothing" },
  { key: "Auto",         label: "🚗 Auto" },
  { key: "Other",        label: "🧩 Other" },
];

/* ─── Store emoji ────────────────────────────────────────────── */

function getStoreEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("walmart"))      return "🛒";
  if (n.includes("target"))       return "🎯";
  if (n.includes("home depot"))   return "🔨";
  if (n.includes("best buy"))     return "💻";
  if (n.includes("costco"))       return "🏪";
  if (n.includes("sam's"))        return "🏬";
  if (n.includes("lowe"))         return "🔧";
  if (n.includes("apple"))        return "🍎";
  if (n.includes("nordstrom"))    return "👗";
  if (n.includes("bloomingdale")) return "🛍️";
  if (n.includes("neiman"))       return "💎";
  if (n.includes("saks"))         return "👑";
  if (n.includes("tj maxx"))      return "🏷️";
  if (n.includes("marshall"))     return "🏷️";
  if (n.includes("ross"))         return "🏷️";
  if (n.includes("burlington"))   return "🧥";
  if (n.includes("nike"))         return "👟";
  if (n.includes("foot locker"))  return "👟";
  if (n.includes("gamestop"))     return "🎮";
  if (n.includes("macy"))         return "🌟";
  if (n.includes("sephora"))      return "💄";
  return "🏬";
}

/* ─── Proximity deal matching ────────────────────────────────── */

// Match deals to a store by lat/lng proximity (~500m)
function matchDealsByProximity(deals: Deal[], lat: number, lng: number): Deal[] {
  return deals.filter((d) => {
    if (typeof d.latitude !== "number" || typeof d.longitude !== "number") return false;
    const dlat = Math.abs(d.latitude - lat);
    const dlng = Math.abs(d.longitude - lng);
    return dlat < 0.005 && dlng < 0.005;
  });
}

/* ─── Fetch nearby stores ────────────────────────────────────── */

async function fetchNearbyStores(
  lat: number,
  lng: number,
  deals: Deal[]
): Promise<NearbyStore[]> {
  if (!GOOGLE_API_KEY) return [];

  const results: NearbyStore[] = [];
  const seen = new Set<string>();

  await Promise.all(
    ALL_STORE_SEARCHES.map(async (storeName) => {
      try {
        const res = await fetch(
          `https://places.googleapis.com/v1/places:searchText`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_API_KEY,
              "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress",
            },
            body: JSON.stringify({
              maxResultCount: 3,
              locationBias: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: 16000,
                },
              },
              textQuery: storeName,
            }),
          }
        );
        const data = await res.json();
        if (data.places) {
          for (const place of data.places) {
            if (seen.has(place.id)) continue;
            seen.add(place.id);

            // Match deals from deals_instore by proximity
            const storeDeals = matchDealsByProximity(
              deals,
              place.location.latitude,
              place.location.longitude
            );

            results.push({
              id: place.id,
              name: place.displayName?.text || storeName,
              latitude: place.location.latitude,
              longitude: place.location.longitude,
              address: place.formattedAddress || "",
              isPremium: isStoreLockedByName(storeName, false),
              deals: storeDeals,
            });
          }
        }
      } catch (e) {
        console.warn(`[MapScreen] Places fetch failed for ${storeName}:`, e);
      }
    })
  );

  return results;
}

/* ─── Store Marker ───────────────────────────────────────────── */

function StoreMarker({ store, selected, onPress, userIsPremium }: {
  store: NearbyStore; selected: boolean; onPress: () => void; userIsPremium: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isLocked = store.isPremium && !userIsPremium;
  const color = isLocked ? "#444" : store.isPremium ? "#a855f7" : ACCENT;
  const emoji = getStoreEmoji(store.name);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: selected ? 1.3 : 1, useNativeDriver: true }).start();
  }, [selected]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[
        marker.wrap,
        { borderColor: color, backgroundColor: selected ? color : "#0f0f0f" },
        { transform: [{ scale: scaleAnim }] },
      ]}>
        <Text style={marker.emoji}>{isLocked ? "🔒" : emoji}</Text>
        <Text style={[marker.name, { color: selected ? "#000" : color }]} numberOfLines={1}>
          {isLocked ? "PRO" : store.name.split(" ")[0]}
        </Text>
        {store.deals.length > 0 && !isLocked && (
          <View style={[marker.badge, { backgroundColor: color }]}>
            <Text style={marker.badgeTxt}>{store.deals.length}</Text>
          </View>
        )}
      </Animated.View>
      <View style={[marker.tail, { borderTopColor: color }]} />
    </TouchableOpacity>
  );
}

const marker = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    minWidth: 52,
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.4, elevation: 5,
  },
  emoji: { fontSize: 14 },
  name: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  badge: {
    position: "absolute", top: -6, right: -6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  badgeTxt: { color: "#000", fontSize: 8, fontWeight: "900" },
  tail: {
    width: 0, height: 0, alignSelf: "center",
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
});

/* ─── Deal Marker ────────────────────────────────────────────── */

function DealMarker({ deal, selected, onPress }: {
  deal: Deal; selected: boolean; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: selected ? 1.3 : 1, useNativeDriver: true }).start();
  }, [selected]);

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

  const color = deal.lightning ? "#facc15" : deal.rare ? "#a855f7" : deal.hot ? "#ef4444" : ACCENT;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View style={[
        dealMarker.wrap,
        { borderColor: color, backgroundColor: selected ? color : "#0f0f0f" },
        { transform: [{ scale: scaleAnim }] },
        deal.lightning && { opacity: flashAnim },
      ]}>
        <Text style={[dealMarker.price, { color: selected ? "#000" : color }]}>
          {deal.lightning ? "⚡" : deal.rare ? "💎" : ""}${Math.round(deal.price)}
        </Text>
      </Animated.View>
      <View style={[dealMarker.tail, { borderTopColor: color }]} />
    </TouchableOpacity>
  );
}

const dealMarker = StyleSheet.create({
  wrap: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
  },
  price: { fontSize: 11, fontWeight: "900" },
  tail: {
    width: 0, height: 0, alignSelf: "center",
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
});

/* ─── Store Row ──────────────────────────────────────────────── */

function StoreRow({ store, onPress, dark, userIsPremium }: {
  store: NearbyStore; onPress: () => void; dark: boolean; userIsPremium: boolean;
}) {
  const isLocked = store.isPremium && !userIsPremium;
  const color = isLocked ? "#444" : store.isPremium ? "#a855f7" : ACCENT;
  const emoji = getStoreEmoji(store.name);

  return (
    <TouchableOpacity
      onPress={isLocked ? undefined : onPress}
      style={[row.card, { backgroundColor: dark ? "#111" : "#f9f9f9", opacity: isLocked ? 0.6 : 1 }]}
      activeOpacity={0.85}
    >
      <View style={[row.bar, { backgroundColor: color }]} />
      <View style={row.content}>
        <View style={row.topRow}>
          <Text style={row.emoji}>{isLocked ? "🔒" : emoji}</Text>
          <Text style={[row.storeName, { color: dark ? "#fff" : "#111" }]} numberOfLines={1}>
            {store.name}
          </Text>
          {store.isPremium && (
            <View style={[row.badge, { backgroundColor: isLocked ? "#333" : "#7c3aed" }]}>
              <Text style={row.badgeTxt}>{isLocked ? "🔒 PRO" : "⭐ PRO"}</Text>
            </View>
          )}
        </View>
        <Text style={[row.address, { color: dark ? "#888" : "#999" }]} numberOfLines={1}>
          📍 {isLocked ? "Upgrade to unlock" : store.address}
        </Text>
        {!isLocked && store.deals.length > 0 && (
          <Text style={row.dealCount}>🔥 {store.deals.length} deals available</Text>
        )}
        {!isLocked && store.deals.length === 0 && (
          <Text style={[row.dealCount, { color: "#555" }]}>No active deals</Text>
        )}
      </View>
      <View style={[row.btn, { backgroundColor: isLocked ? "#333" : color }]}>
        <Text style={row.btnTxt}>{isLocked ? "PRO" : "VIEW"}</Text>
      </View>
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
  topRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  emoji: { fontSize: 16 },
  storeName: { fontSize: 14, fontWeight: "800", flex: 1 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeTxt: { color: "#fff", fontSize: 8, fontWeight: "900" },
  address: { fontSize: 11, marginBottom: 2 },
  dealCount: { fontSize: 11, color: ACCENT, fontWeight: "700" },
  btn: {
    margin: 10, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, alignItems: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "900", fontSize: 10 },
});

/* ─── Deal Row (in store sheet) ──────────────────────────────── */

function StoreDealRow({ deal, dark, onPress }: {
  deal: Deal; dark: boolean; onPress: () => void;
}) {
  const color = deal.lightning ? "#facc15" : deal.rare ? "#a855f7" : deal.hot ? "#ef4444" : ACCENT;
  return (
    <TouchableOpacity
      style={[styles.dealRow, { backgroundColor: dark ? "#1a1a1a" : "#f4f4f4" }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.dealBar, { backgroundColor: color }]} />
      {deal.imageUrl ? (
        <Image source={{ uri: deal.imageUrl }} style={styles.dealThumb} />
      ) : (
        <View style={[styles.dealThumb, styles.dealThumbFallback]}>
          <Text style={{ fontSize: 22 }}>{getStoreEmoji(deal.store || "")}</Text>
        </View>
      )}
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={{ color: dark ? "#fff" : "#111", fontWeight: "700", fontSize: 13 }} numberOfLines={2}>
          {deal.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text style={{ color, fontWeight: "900", fontSize: 15 }}>
            ${Number(deal.price).toFixed(2)}
          </Text>
          {deal.originalPrice ? (
            <Text style={{ color: "#666", fontSize: 11, textDecorationLine: "line-through" }}>
              ${Number(deal.originalPrice).toFixed(2)}
            </Text>
          ) : null}
          {deal.discountPercent ? (
            <View style={{ backgroundColor: color + "22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color, fontSize: 10, fontWeight: "900" }}>-{deal.discountPercent}%</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.dealBtn, { backgroundColor: color, flexDirection: "row", alignItems: "center", gap: 3 }]}>
        <Ionicons name="navigate" size={12} color="#000" />
        <Text style={styles.dealBtnTxt}>DriveMe</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ─── Main Screen ────────────────────────────────────────────── */

const RADIUS_DEFAULT = 10; // miles; adjustable

function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 3958.8; // earth radius in miles
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function MapScreen() {
  const [instoreDeals, setInstoreDeals] = useState<Deal[]>([]);
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStores, setLoadingStores] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [radiusMiles, setRadiusMiles] = useState(RADIUS_DEFAULT);
  const [locationDenied, setLocationDenied] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);
  const [searchArea, setSearchArea] = useState(false);
  const [viewMode, setViewMode] = useState<"stores" | "deals">("stores");
  const [selectedStore, setSelectedStore] = useState<NearbyStore | null>(null);

  const mapRef = useRef<MapView>(null);
  const { theme, colors } = useTheme();
  const { isPremium } = useUser();
  const dark = theme === "dark";

  const sheetY = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const lastSheetY = useRef(SHEET_COLLAPSED);

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { sheetY.stopAnimation(); },
      onPanResponderMove: (_, g) => {
        const newY = lastSheetY.current - g.dy;
        sheetY.setValue(Math.max(SHEET_COLLAPSED, Math.min(SHEET_FULL, newY)));
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

  // Subscribe to deals_instore (have lat/lng)
  useEffect(() => {
    const unsubscribe = db.collection("deals_instore")
      .where("live", "==", true)
      .onSnapshot((snap) => {
        const items: Deal[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Deal, "id">),
        }));
        setInstoreDeals(items);
      });
    return () => unsubscribe();
  }, []);

  // Load location and stores once
  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationDenied(true); setLoading(false); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setUserLocation({ latitude, longitude });
      const r = { latitude, longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
      setRegion(r);
      setCurrentRegion(r);
      setLoading(false);
      setLoadingStores(true);
      const stores = await fetchNearbyStores(latitude, longitude, []);
      setNearbyStores(stores);
      setLoadingStores(false);
    };
    loadLocation();
  }, []);

  // Re-match deals to stores whenever deals OR stores change
  useEffect(() => {
    if (nearbyStores.length === 0) return;
    setNearbyStores((prev) =>
      prev.map((store) => ({
        ...store,
        deals: matchDealsByProximity(instoreDeals, store.latitude, store.longitude),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instoreDeals, nearbyStores.length]);

  const searchThisArea = async () => {
    if (!currentRegion) return;
    setSearchArea(false);
    setLoadingStores(true);
    const stores = await fetchNearbyStores(currentRegion.latitude, currentRegion.longitude, instoreDeals);
    setNearbyStores(stores);
    setLoadingStores(false);
  };

  // Only in-store deals within radiusMiles of the user
  const nearbyInstoreDeals = useMemo(() => {
    if (!userLocation) return [];
    return instoreDeals.filter((d) =>
      d.latitude != null && d.longitude != null &&
      distanceMiles(userLocation, { latitude: d.latitude, longitude: d.longitude }) <= radiusMiles
    );
  }, [instoreDeals, userLocation, radiusMiles]);

  const filteredDeals = useMemo(() => {
    if (selectedCategory === "All") return nearbyInstoreDeals;
    return nearbyInstoreDeals.filter((d) => (d.category ?? "Other") === selectedCategory);
  }, [nearbyInstoreDeals, selectedCategory]);

  const premiumStoreCount = nearbyStores.filter(s => s.isPremium).length;

  const handleStorePress = (store: NearbyStore) => {
    if (store.isPremium && !isPremium) return;
    setSelectedId(store.id);
    setSelectedStore(store);
    mapRef.current?.animateToRegion({
      latitude: store.latitude - 0.003,
      longitude: store.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 400);
    snapSheet(store.deals.length > 0 ? SHEET_HALF : SHEET_COLLAPSED + 80);
  };

  const recenter = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 500);
  };

  const openDeal = (deal: Deal) => {
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (url) Linking.openURL(url);
  };

  const driveTo = (deal: Deal) => {
    const lat = deal.latitude, lng = deal.longitude;
    const label = encodeURIComponent(deal.store || deal.title || "Deal");
    const url = Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  };

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

  const sheetStores = selectedStore
    ? [selectedStore, ...nearbyStores.filter(s => s.id !== selectedStore.id)]
    : nearbyStores;

  // When a store is selected, show its deals in the sheet
  const sheetDeals = selectedStore ? selectedStore.deals : filteredDeals;

  return (
    <View style={styles.safe}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        customMapStyle={dark ? darkMapStyle : []}
        showsUserLocation={false}
        onRegionChange={(r) => { setCurrentRegion(r); setSearchArea(true); }}
        onPress={() => {
          setSelectedId(null);
          setSelectedStore(null);
          snapSheet(SHEET_COLLAPSED);
        }}
      >
        {userLocation && (
          <>
            <Circle
              center={userLocation}
              radius={300}
              fillColor="rgba(255,122,0,0.06)"
              strokeColor="rgba(255,122,0,0.25)"
              strokeWidth={1}
            />
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.userDot}>
                <View style={styles.userDotInner} />
              </View>
            </Marker>
          </>
        )}

        {viewMode === "stores" && nearbyStores.map((store) => (
          <Marker
            key={store.id}
            coordinate={{ latitude: store.latitude, longitude: store.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => handleStorePress(store)}
          >
            <StoreMarker
              store={store}
              selected={selectedId === store.id}
              onPress={() => handleStorePress(store)}
              userIsPremium={isPremium}
            />
          </Marker>
        ))}

        {viewMode === "deals" && filteredDeals.map((deal) => {
          const onDealPress = () => {
            setSelectedId(deal.id);
            mapRef.current?.animateToRegion({ latitude: deal.latitude - 0.003, longitude: deal.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
            snapSheet(SHEET_HALF);
          };
          return (
            <Marker
              key={deal.id}
              coordinate={{ latitude: deal.latitude, longitude: deal.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={onDealPress}
              tracksViewChanges={false}
            >
              <DealMarker
                deal={deal}
                selected={selectedId === deal.id}
                onPress={onDealPress}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* ── Top overlay ── */}
      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === "stores" && styles.modeBtnActive]}
            onPress={() => { setViewMode("stores"); setSelectedStore(null); setSelectedId(null); }}
          >
            <Text style={[styles.modeBtnText, viewMode === "stores" && { color: "#000" }]}>🏬 Stores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, viewMode === "deals" && styles.modeBtnActive]}
            onPress={() => { setViewMode("deals"); setSelectedStore(null); setSelectedId(null); }}
          >
            <Text style={[styles.modeBtnText, viewMode === "deals" && { color: "#000" }]}>🔥 Deals</Text>
          </TouchableOpacity>
        </View>

        {viewMode === "deals" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setSelectedCategory(cat.key)}
                style={[styles.chip, { backgroundColor: selectedCategory === cat.key ? ACCENT : "rgba(0,0,0,0.75)" }]}
              >
                <Text style={[styles.chipText, { color: selectedCategory === cat.key ? "#000" : "#fff" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {!isPremium && premiumStoreCount > 0 && (
          <View style={styles.premiumBanner}>
            <Text style={styles.premiumBannerText}>
              🔒 {premiumStoreCount} premium stores locked — Upgrade to unlock
            </Text>
          </View>
        )}
      </SafeAreaView>

      {searchArea && (
        <TouchableOpacity style={styles.searchAreaBtn} onPress={searchThisArea}>
          {loadingStores
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="search-outline" size={14} color="#fff" />
          }
          <Text style={styles.searchAreaText}>
            {loadingStores ? "Searching..." : "Search this area"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
        <Ionicons name="locate-outline" size={20} color={ACCENT} />
      </TouchableOpacity>

      <View style={styles.countPill}>
        <View style={styles.countDot} />
        <Text style={styles.countText}>
          {viewMode === "stores"
            ? `${nearbyStores.length} stores nearby`
            : `${filteredDeals.length} deals nearby`}
        </Text>
      </View>

      {/* ── Bottom sheet ── */}
      <Animated.View style={[styles.sheet, { height: sheetY, backgroundColor: colors.background }]}>
        <View {...sheetPanResponder.panHandlers} style={styles.handleWrap}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              {selectedStore && (
                <Text style={{ color: "#888", fontSize: 11, marginBottom: 2 }}>
                  {getStoreEmoji(selectedStore.name)} {selectedStore.name}
                </Text>
              )}
              <Text style={[styles.sheetTitle, { color: dark ? "#fff" : "#111" }]}>
                {selectedStore
                  ? selectedStore.deals.length > 0
                    ? `${selectedStore.deals.length} Deals Here`
                    : "No active deals"
                  : viewMode === "stores"
                    ? `${nearbyStores.length} Stores Near You`
                    : `${filteredDeals.length} Deals Near You`}
              </Text>
            </View>
            <View style={styles.sheetSnapBtns}>
              {selectedStore && (
                <TouchableOpacity
                  onPress={() => { setSelectedStore(null); setSelectedId(null); snapSheet(SHEET_COLLAPSED); }}
                  style={{ marginRight: 4 }}
                >
                  <Ionicons name="close-outline" size={20} color="#666" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => snapSheet(SHEET_HALF)}>
                <Ionicons name="remove-outline" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => snapSheet(SHEET_FULL)}>
                <Ionicons name="chevron-up-outline" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Store deals view when a store is selected */}
        {selectedStore ? (
          <FlatList
            data={sheetDeals}
            keyExtractor={(d) => d.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.emptySheet}>
                <Ionicons name="pricetag-outline" size={36} color="#444" />
                <Text style={styles.emptySheetText}>No deals at this store</Text>
                <Text style={styles.emptySheetSub}>Check back later for new deals</Text>
              </View>
            }
            renderItem={({ item }) => (
              <StoreDealRow deal={item} dark={dark} onPress={() => driveTo(item)} />
            )}
          />
        ) : viewMode === "stores" ? (
          <FlatList
            data={sheetStores}
            keyExtractor={(s) => s.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={styles.emptySheet}>
                <Ionicons name="storefront-outline" size={36} color="#444" />
                <Text style={styles.emptySheetText}>No stores found</Text>
                <Text style={styles.emptySheetSub}>Move the map and tap "Search this area"</Text>
              </View>
            }
            renderItem={({ item }) => (
              <StoreRow
                store={item}
                dark={dark}
                userIsPremium={isPremium}
                onPress={() => {
                  handleStorePress(item);
                  mapRef.current?.animateToRegion({
                    latitude: item.latitude,
                    longitude: item.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }, 500);
                }}
              />
            )}
          />
        ) : (
          <FlatList
            data={filteredDeals}
            keyExtractor={(d) => d.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              locationDenied ? (
                <View style={styles.emptySheet}>
                  <Ionicons name="location-outline" size={36} color={ACCENT} />
                  <Text style={styles.emptySheetText}>See deals near you</Text>
                  <Text style={styles.emptySheetSub}>Enable location to find in-store deals within {radiusMiles} miles.</Text>
                  <TouchableOpacity
                    style={styles.enableLocBtn}
                    onPress={async () => {
                      const { status } = await Location.requestForegroundPermissionsAsync();
                      if (status === "granted") {
                        setLocationDenied(false);
                        const loc = await Location.getCurrentPositionAsync({});
                        const { latitude, longitude } = loc.coords;
                        setUserLocation({ latitude, longitude });
                        const r = { latitude, longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
                        setRegion(r);
                        setCurrentRegion(r);
                      } else {
                        Linking.openSettings();
                      }
                    }}
                  >
                    <Text style={styles.enableLocBtnText}>Enable Location</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptySheet}>
                  <Ionicons name="map-outline" size={36} color="#444" />
                  <Text style={styles.emptySheetText}>No deals in this area</Text>
                  <Text style={styles.emptySheetSub}>Move the map to explore other zones</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <StoreDealRow deal={item} dark={dark} onPress={() => driveTo(item)} />
            )}
          />
        )}
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
  modeToggle: {
    flexDirection: "row", alignSelf: "center", marginTop: 12,
    backgroundColor: "rgba(0,0,0,0.8)", borderRadius: 999,
    padding: 3, gap: 2, borderWidth: 1, borderColor: "rgba(255,122,0,0.3)",
  },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  modeBtnActive: { backgroundColor: ACCENT },
  modeBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  chipRow: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    shadowColor: "#000", shadowRadius: 4, shadowOpacity: 0.3, elevation: 4,
  },
  chipText: { fontSize: 12, fontWeight: "800" },
  premiumBanner: {
    marginHorizontal: 12, marginTop: 8,
    backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "rgba(255,122,0,0.3)",
  },
  premiumBannerText: { color: ACCENT, fontSize: 11, fontWeight: "800", textAlign: "center" },
  searchAreaBtn: {
    position: "absolute", top: SH * 0.2, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#1a1a1a", paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1, borderColor: ACCENT + "55",
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
    backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,122,0,0.3)",
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
  enableLocBtn: {
    marginTop: 16, backgroundColor: ACCENT, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 10,
  },
  enableLocBtnText: { color: "#000", fontWeight: "800", fontSize: 14 },
  dealRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, marginHorizontal: 12, marginBottom: 8, overflow: "hidden",
  },
  dealBar: { width: 4, alignSelf: "stretch" },
  dealThumb: { width: 54, height: 54, borderRadius: 8, margin: 8, backgroundColor: "#222" },
  dealThumbFallback: { alignItems: "center", justifyContent: "center" },
  dealBtn: {
    backgroundColor: ACCENT, margin: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, alignItems: "center",
  },
  dealBtnTxt: { color: "#000", fontWeight: "900", fontSize: 10 },
});

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#a9b4c2" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d5dae0" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#2b3648" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#9aa5b1" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FF7A00" }, { lightness: -40 }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];