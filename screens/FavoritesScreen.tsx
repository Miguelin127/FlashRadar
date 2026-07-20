// flashradar/screens/FavoritesScreen.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  FlatList, Animated, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { auth, db } from "../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";
import { useUser } from "../context/UserContext";
import { isStoreLocked } from "../constants/premiumStores";
import { StatusBar } from "expo-status-bar";
import { usePulseAnimation } from "../FlashRadar/hooks/usePulseAnimation";

type Deal = {
  id: string;
  title: string;
  store: string;
  storeKey?: string;
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
  const aHarv = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return (R * 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv))) / 1609.344;
}

export default function FavoritesScreen() {
  const { language } = useLanguage();
  const t = getStrings(language);
  const [favorites, setFavorites] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const navigation = useNavigation();
  const { isPremium } = useUser();
  const { theme, colors } = useTheme();
  const isDarkMode = theme === "dark";

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  const fetchFavorites = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setFavorites([]); setLoading(false); return; }

      // ── Compat SDK ─────────────────────────────────────────────────────────
      const snap = await db
        .collection("users")
        .doc(user.uid)
        .collection("favorites")
        .get();

      setFavorites(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deal, "id">), isSaved: true }))
      );
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchFavorites(); }, []));

  const toggleSave = async (deal: Deal) => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = db.collection("users").doc(user.uid).collection("favorites").doc(deal.id);
    try {
      if (deal.isSaved) {
        await ref.delete();
        setFavorites((prev) => prev.filter((d) => d.id !== deal.id));
      } else {
        await ref.set(deal, { merge: true });
        setFavorites((prev) => [...prev, { ...deal, isSaved: true }]);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  const clearAll = async () => {
    const user = auth.currentUser;
    if (!user) return;
    for (const fav of favorites) {
      await db.collection("users").doc(user.uid).collection("favorites").doc(fav.id).delete();
    }
    setFavorites([]);
  };

  const openDeal = async (deal: Deal) => {
    // ── Affiliate URL first ───────────────────────────────────────────────────
    const url = deal.affiliateUrl || deal.merchantUrl || deal.url;
    if (!url) return;
    try { await Linking.openURL(url); } catch (e) { console.warn(e); }
  };

  const openMaps = (deal: Deal) => {
    if (deal.source === "online" || !deal.latitude || !deal.longitude) return;
    const url = Platform.select({
      ios: `maps://?q=${deal.address || deal.store}&ll=${deal.latitude},${deal.longitude}`,
      android: `geo:${deal.latitude},${deal.longitude}?q=${deal.address || deal.store}`,
    });
    if (url) Linking.openURL(url);
  };

  const PulseTag = ({ text, color }: { text: string; color: string }) => {
    const { triggerPulse, ringStyle } = usePulseAnimation(500, 1.3);
    useEffect(() => { triggerPulse(); }, []);
    return (
      <View style={{ position: "relative", marginRight: 6 }}>
        <Animated.View style={ringStyle} />
        <Text style={[styles.tagBase, { color }]}>{text}</Text>
      </View>
    );
  };

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></SafeAreaView>;
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        <Ionicons name="heart-outline" size={64} color={colors.text} />
        <Text style={[styles.empty, { color: colors.text }]}>{t.favorites.noFavorites}</Text>
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: "#FF6600" }]}
          onPress={() => navigation.navigate("Explore" as never)}
        >
          <Text style={styles.exploreText}>{t.favorites.exploreDeal}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
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
          const isLocked = isStoreLocked(item.storeKey, isPremium);
          const isLive = item.timestamp && Date.now() / 1000 - (item.timestamp.seconds || 0) < 600;
          return (
            <View style={[styles.cardWrapper, { backgroundColor: isDarkMode ? "#1E1E1E" : "#fff", borderColor: isDarkMode ? "#333" : "#ddd" }]}>
              <DealCard
                deal={{ ...item, hot: isHot, live: isLive, rare: item.rare, isSaved: true }}
                onSaveToggle={() => toggleSave(item)}
                onPress={() => { if (isLocked) { (navigation as any).navigate("Upgrade"); } else { openDeal(item); } }}
                darkMode={isDarkMode}
                blurred={isLocked}
              />
              <View style={styles.tagRow}>
                {isLive && <PulseTag text="🟢 Live" color="green" />}
                {isHot && <PulseTag text="🔥 Hot" color="red" />}
                {item.rare && <PulseTag text="🦄 Rare Find" color="purple" />}
              </View>
              {(item.source === "local" || (item.latitude && item.longitude)) && (
                <View style={styles.metaRow}>
                  {userLocation && item.latitude && item.longitude && (
                    <Text style={[styles.distanceBadge, { backgroundColor: isDarkMode ? "#333" : "#eee", color: isDarkMode ? "#eee" : "#333" }]}>
                      {distanceMiles(userLocation, { latitude: item.latitude, longitude: item.longitude }).toFixed(1)} mi
                    </Text>
                  )}
                  {item.address && (
                    <TouchableOpacity style={styles.directionsButton} onPress={() => openMaps(item)}>
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
  cardWrapper: { marginBottom: 12, borderWidth: 1, borderRadius: 10, padding: 6 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingHorizontal: 10 },
  header: { fontSize: 22, fontWeight: "700" },
  clearBtn: { flexDirection: "row", backgroundColor: "#FF6600", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
  clearText: { color: "#fff", marginLeft: 4, fontSize: 13 },
  tagRow: { flexDirection: "row", marginLeft: 12, marginTop: 4 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 8, marginTop: 4 },
  distanceBadge: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  directionsButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF6600", borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  directionsText: { color: "#fff", marginLeft: 4, fontSize: 11 },
  tagBase: { fontSize: 12, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 20, fontSize: 16 },
  exploreButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  exploreText: { color: "#fff", fontWeight: "600" },
});