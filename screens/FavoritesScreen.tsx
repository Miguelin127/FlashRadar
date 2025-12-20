// flashradar/screens/FavoritesScreen.tsx
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

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  discount?: number;
  image?: string;
  rare?: boolean;
  isSaved?: boolean;
  timestamp?: any;
  address?: string;
  latitude?: number;
  longitude?: number;
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
  const meters = R * c;
  return meters / 1609.344;
}

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  const navigation = useNavigation();
  const { theme, colors } = useTheme();
  const isDarkMode = theme === "dark";

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

  const fetchFavorites = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      const favsRef = collection(db, "users", user.uid, "favorites");
      const querySnapshot = await getDocs(favsRef);
      const saved: Deal[] = querySnapshot.docs.map((docSnap) => ({
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

  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;
    const favRef = doc(db, "users", user.uid, "favorites", deal.id);
    try {
      if (deal.isSaved) {
        await deleteDoc(favRef);
        setFavorites((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        await setDoc(favRef, deal, { merge: true });
        setFavorites((prev) => [...prev, { ...deal, isSaved: true }]);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const clearAll = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      for (let fav of favorites) {
        const favRef = doc(db, "users", user.uid, "favorites", fav.id);
        await deleteDoc(favRef);
      }
      setFavorites([]);
    } catch (err) {
      console.error("Error clearing favorites:", err);
    }
  };

  const getDistanceBadge = (deal: Deal) => {
    if (
      deal.source === "online" ||
      !deal.latitude ||
      !deal.longitude ||
      !userLocation
    ) {
      return null;
    }

    const miles = distanceMiles(userLocation, {
      latitude: deal.latitude,
      longitude: deal.longitude,
    });

    if (miles > 500 || isNaN(miles)) return null;

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

  const openMaps = (deal: Deal) => {
    if (deal.source === "online") return; // ✅ skip for online deals
    if (deal.latitude && deal.longitude) {
      const url = Platform.select({
        ios: `maps://?q=${deal.address || deal.store}&ll=${deal.latitude},${deal.longitude}`,
        android: `geo:${deal.latitude},${deal.longitude}?q=${deal.address || deal.store}`,
      });
      if (url) Linking.openURL(url);
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
      </SafeAreaView>
    );
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} translucent />
        <Ionicons name="heart-outline" size={64} color={colors.text} />
        <Text style={[styles.empty, { color: colors.text }]}>No favorites yet.</Text>
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: "#FF6600" }]}
          onPress={() => navigation.navigate("Explore" as never)}
        >
          <Text style={styles.exploreText}>Explore Deals</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
            item.timestamp && Date.now() / 1000 - (item.timestamp.seconds || 0) < 600;
          const isRare = item.rare;

          return (
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
              <DealCard
                deal={{ ...item, hot: isHot, live: isLive, rare: isRare }}
                isSaved={true}
                onSaveToggle={() => toggleSave(item)}
                darkMode={isDarkMode}
                onPress={() =>
  (navigation as any).navigate("DealDetail", { deal: item })
}
              />

              {/* Tags */}
              <View style={styles.tagRow}>
                {isLive && <PulseTag text="🟢 Live" color="green" />}
                {isHot && <PulseTag text="🔥 Hot" color="red" />}
                {isRare && <PulseTag text="🦄 Rare Find" color="purple" />}
              </View>

              {/* Divider */}
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

              {/* ✅ Show distance & directions only for local deals */}
              {(item.source === "local" || (item.latitude && item.longitude)) && (
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
          );
        }}
      />
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
