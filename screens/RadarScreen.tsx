// flashradar/screens/RadarScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { usePulseAnimation } from "../FlashRadar/hooks/usePulseAnimation";

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  discountPercent?: number | null;
  image?: string | null;
  timestamp?: any;
  rare?: boolean;
  isSaved?: boolean;
  zip?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  isHot?: boolean;
  source?: "local" | "online";
};

function distanceMiles(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aHarv =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return (R * c) / 1609.344;
}

function isValidOnlineDeal(d: Deal) {
  // ✅ kill the junk docs that make it look like “nothing changes”
  if (d.source !== "online") return true;

  const title = (d.title || "").trim();
  const price = Number(d.price);

  if (!title) return false;
  if (title.toLowerCase() === "amazon item") return false;
  if (!Number.isFinite(price) || price <= 0) return false;

  // optional: require image for online
  // if (!d.image) return false;

  return true;
}

export default function RadarScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapView, setMapView] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  const isDarkMode = theme === "dark";
  const { triggerPulse, ringStyle } = usePulseAnimation(300, 1.3);

  useEffect(() => {
    const qLocal = query(collection(db, "deals"), orderBy("timestamp", "desc"));
    const qOnline = query(
      collection(db, "deals_online"),
      orderBy("timestamp", "desc")
    );

    const unsubLocal = onSnapshot(qLocal, (snap) => {
      const local = snap.docs.map((d) => ({
        ...(d.data() as Deal),
        id: d.id,
        source: "local" as const,
      }));

      // keep online first, local after
      setDeals((prev) => [
        ...prev.filter((x) => x.source === "online"),
        ...local,
      ]);
      setLoading(false);
    });

    const unsubOnline = onSnapshot(qOnline, (snap) => {
      const online = snap.docs.map((d) => ({
        ...(d.data() as Deal),
        id: d.id,
        source: "online" as const,
      }));

      // ✅ FILTER OUT INVALID ONLINE DOCS (the $0.00 ones)
      const onlineClean = online.filter(isValidOnlineDeal);

      setDeals((prev) => [
        ...onlineClean,
        ...prev.filter((x) => x.source === "local"),
      ]);
      setLoading(false);
    });

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();

    return () => {
      unsubLocal();
      unsubOnline();
    };
  }, []);

  const cleanedDeals = useMemo(() => deals.filter(isValidOnlineDeal), [deals]);

  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;
    const favRef = doc(db, "users", user.uid, "favorites", deal.id);
    triggerPulse();
    try {
      if (deal.isSaved) {
        await deleteDoc(favRef);
      } else {
        await setDoc(favRef, deal, { merge: true });
      }
      setDeals((prev) =>
        prev.map((d) =>
          d.id === deal.id ? { ...d, isSaved: !d.isSaved } : d
        )
      );
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const openMaps = (deal: Deal) => {
    if (deal.source === "online") return;
    if (deal.latitude && deal.longitude) {
      const url = Platform.select({
        ios: `maps://?q=${deal.address || deal.store}&ll=${deal.latitude},${deal.longitude}`,
        android: `geo:${deal.latitude},${deal.longitude}?q=${
          deal.address || deal.store
        }`,
      });
      if (url) Linking.openURL(url);
    }
  };

  const getDistanceBadge = (deal: Deal) => {
    if (
      deal.source === "online" ||
      !deal.latitude ||
      !deal.longitude ||
      !userLocation
    )
      return null;
    const miles = distanceMiles(userLocation, {
      latitude: deal.latitude,
      longitude: deal.longitude,
    });
    return (
      <Text
        style={[
          styles.distanceBadge,
          {
            backgroundColor: isDarkMode ? "#333" : "#eee",
            color: isDarkMode ? "#eee" : "#333",
          },
        ]}
      >
        {miles.toFixed(1)} mi
      </Text>
    );
  };

  const renderTags = (deal: Deal) => {
    if (deal.isHot) return <Text style={styles.tagHot}>🔥 Hot</Text>;
    if (deal.rare) return <Text style={styles.tagRare}>🦄 Rare Find</Text>;
    return null;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {mapView ? (
        <MapView
          style={{ flex: 1, borderRadius: 10 }}
          initialRegion={{
            latitude: 41.8781,
            longitude: -87.6298,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          }}
        >
          {cleanedDeals
            .filter((deal) => deal.source !== "online" && deal.latitude && deal.longitude)
            .map((deal) => (
              <Marker
                key={deal.id}
                coordinate={{ latitude: deal.latitude!, longitude: deal.longitude! }}
                title={deal.title}
                description={deal.address || ""}
              />
            ))}
        </MapView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* LIVE Radar Strip */}
          <View
            style={[
              styles.liveStrip,
              {
                backgroundColor: isDarkMode ? "#1a1a1a" : "#f7f7f7",
                borderColor: colors.accent,
              },
            ]}
          >
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.liveText, { color: colors.accent }]}>
              LIVE DEAL RADAR — scanning for drops
            </Text>
          </View>

          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.listContent,
              { backgroundColor: colors.background },
            ]}
            data={cleanedDeals}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.cardWrapper,
                  {
                    backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
                    borderColor: isDarkMode ? "#333" : "#ddd",
                    shadowColor: "#000",
                    shadowOpacity: 0.2,
                    shadowOffset: { width: 0, height: 1 },
                    shadowRadius: 2,
                    elevation: 2,
                  },
                ]}
              >
                <Animated.View
                  style={[ringStyle, { alignSelf: "flex-end", top: 10, right: 12 }]}
                />

                <DealCard
                  deal={item}
                  onPress={() =>
                    (navigation as any).navigate("DealDetail", { deal: item })
                  }
                  onSaveToggle={() => toggleSave(item)}
                  darkMode={isDarkMode}
                  showOpenDealButton={false}
                  compact
                />

                {renderTags(item)}

                <View
                  style={{
                    height: 1,
                    backgroundColor: isDarkMode
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(0,0,0,0.3)",
                    marginVertical: 6,
                    marginHorizontal: 10,
                  }}
                />

                {item.source === "local" && (
                  <View style={styles.metaRow}>
                    {getDistanceBadge(item)}
                    {item.address && (
                      <TouchableOpacity
                        style={styles.directionsButton}
                        onPress={() => openMaps(item)}
                      >
                        <Ionicons name="car" size={14} color="#fff" />
                        <Text style={styles.directionsText}>Directions</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.text }]}>
                No valid deals yet (filtered out $0 / placeholder items).
              </Text>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 10 },
  cardWrapper: {
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 6,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 8,
    marginTop: 4,
  },
  distanceBadge: {
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: "hidden",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6600",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  directionsText: { color: "#fff", marginLeft: 4, fontSize: 11 },
  tagHot: { color: "#FF3B30", marginLeft: 12, marginTop: 4, fontSize: 13 },
  tagRare: { color: "#A020F0", marginLeft: 12, marginTop: 4, fontSize: 13 },
  empty: { textAlign: "center", marginTop: 20 },

  liveStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  liveText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
