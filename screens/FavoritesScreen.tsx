// flashradar/screens/FavoritesScreen.tsx
// FULL FILE — URL-AWARE (merchantUrl / affiliateUrl) — NO SHORTENING

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Animated,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";
import { StatusBar } from "expo-status-bar";
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

  isSaved?: boolean;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;

  source?: "local" | "online";
  discountPercent?: number | null;

  timestamp?: any;
  expiresAt?: number | null;
  address?: string;
  latitude?: number;
  longitude?: number;
};


/* ───────────────── GEO HELPERS ───────────────── */

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
  const meters = R * c;
  return meters / 1609.344;
}

/* ───────────────── SCREEN ───────────────── */

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  const isDarkMode = theme === "dark";

  /* ───────── LOCATION ───────── */

  useEffect(() => {
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
  }, []);

  /* ───────── LOAD FAVORITES ───────── */

  const fetchFavorites = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const favsRef = collection(db, "users", user.uid, "favorites");
      const snap = await getDocs(favsRef);

      const saved: Deal[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Deal, "id">),
        isSaved: true,
      }));

      setFavorites(saved);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [])
  );

  /* ───────── SAVE / UNSAVE ───────── */

  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid, "favorites", deal.id);

    try {
      if (deal.isSaved) {
        await deleteDoc(ref);
        setFavorites((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        await setDoc(ref, deal, { merge: true });
        setFavorites((prev) => [...prev, { ...deal, isSaved: true }]);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  /* ───────── CLEAR ALL ───────── */

  const clearAll = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      for (const fav of favorites) {
        await deleteDoc(doc(db, "users", user.uid, "favorites", fav.id));
      }
      setFavorites([]);
    } catch (err) {
      console.error("Error clearing favorites:", err);
    }
  };

  /* ───────── OPEN DEAL (DIRECT MERCHANT) ───────── */

  const openDeal = async (deal: Deal) => {
    const url =
      deal.merchantUrl ||
      deal.affiliateUrl ||
      deal.url;

    if (!url) return;

    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn("Failed to open deal URL", e);
    }
  };

  /* ───────── MAPS ───────── */

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

  /* ───────── TAG ───────── */

  const PulseTag = ({ text, color }: { text: string; color: string }) => {
    const { triggerPulse, ringStyle } = usePulseAnimation(500, 1.3);
    useEffect(() => {
      triggerPulse();
    }, []);
    return (
      <View style={{ position: "relative", marginRight: 6 }}>
        <Animated.View style={ringStyle} />
        <Text style={[styles.tagBase, { color }]}>{text}</Text>
      </View>
    );
  };

  /* ───────── LOADING / EMPTY ───────── */

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </SafeAreaView>
    );
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <StatusBar style={theme === "dark" ? "light" : "dark"} translucent />
        <Ionicons name="heart-outline" size={64} color={colors.text} />
        <Text style={[styles.empty, { color: colors.text }]}>
          No favorites yet.
        </Text>
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: "#FF6600" }]}
          onPress={() => navigation.navigate("Explore" as never)}
        >
          <Text style={styles.exploreText}>Explore Deals</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ───────── UI ───────── */

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={theme === "dark" ? "light" : "dark"} translucent />

      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: "#FF6600" }]}>❤️ Favorites</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isHot = item.price < 10;
          const isLive =
            item.timestamp &&
            Date.now() / 1000 - (item.timestamp.seconds || 0) < 600;
          const isRare = item.rare;

          return (
            <View
              style={[
                styles.cardWrapper,
                {
                  backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
                  borderColor: isDarkMode ? "#333" : "#ddd",
                },
              ]}
            >
              <DealCard
                deal={{
                  ...item,
                  hot: isHot,
                  live: isLive,
                  rare: isRare,
                  isSaved: true,
                }}
                onSaveToggle={() => toggleSave(item)}
                onPress={() => openDeal(item)}
                darkMode={isDarkMode}
              />

              <View style={styles.tagRow}>
                {isLive && <PulseTag text="🟢 Live" color="green" />}
                {isHot && <PulseTag text="🔥 Hot" color="red" />}
                {isRare && <PulseTag text="🦄 Rare Find" color="purple" />}
              </View>

              {(item.source === "local" ||
                (item.latitude && item.longitude)) && (
                <View style={styles.metaRow}>
                  {userLocation &&
                    item.latitude &&
                    item.longitude && (
                      <Text
                        style={[
                          styles.distanceBadge,
                          {
                            backgroundColor: isDarkMode ? "#333" : "#eee",
                            color: isDarkMode ? "#eee" : "#333",
                          },
                        ]}
                      >
                        {distanceMiles(userLocation, {
                          latitude: item.latitude,
                          longitude: item.longitude,
                        }).toFixed(1)}{" "}
                        mi
                      </Text>
                    )}

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
          );
        }}
      />
    </SafeAreaView>
  );
}

/* ───────────────── STYLES ───────────────── */

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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  header: { fontSize: 22, fontWeight: "700" },
  clearBtn: {
    flexDirection: "row",
    backgroundColor: "#FF6600",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  clearText: { color: "#fff", marginLeft: 4, fontSize: 13 },
  tagRow: { flexDirection: "row", marginLeft: 12, marginTop: 4 },
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
  tagBase: { fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 20, fontSize: 16 },
  exploreButton: {
    backgroundColor: "#FF6600",
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exploreText: { color: "#fff", fontWeight: "600" },
});
