// flashradar/screens/FavoritesScreen.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  FlatList, Animated, Platform, Linking, Image, TextInput,
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

type WishlistItem = {
  id: string;
  title: string;
  imageUrl: string;
  url: string;
  currentPrice: number;
  targetPrice: number;
  notifyWhenBelow: boolean;
  addedAt: Date;
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
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [tab, setTab] = useState<"favorites" | "wishlist">("favorites");
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

  const fetchWishlist = async () => {
    try {
      const user = auth.currentUser;
      if (!user) { setWishlist([]); return; }
      const snap = await db.collection("wishlists").doc(user.uid).get();
      setWishlist(snap.data()?.items || []);
    } catch (err) {
      console.error("Error fetching wishlist:", err);
    }
  };

  useFocusEffect(useCallback(() => { 
    fetchFavorites(); 
    fetchWishlist();
  }, []));

  const clearAll = () => {
    if (tab === "favorites") {
      setFavorites([]);
      auth.currentUser && db.collection("users").doc(auth.currentUser.uid).collection("favorites").get().then((snap) => {
        snap.docs.forEach((d) => d.ref.delete());
      });
    }
  };

  const removeWishlistItem = async (id: string) => {
    if (!auth.currentUser) return;
    const updated = wishlist.filter((i) => i.id !== id);
    await db.collection("wishlists").doc(auth.currentUser.uid).set({ items: updated });
    setWishlist(updated);
  };

  const updateWishlistTarget = async (id: string, targetPrice: number) => {
    if (!auth.currentUser) return;
    const updated = wishlist.map((i) => (i.id === id ? { ...i, targetPrice } : i));
    await db.collection("wishlists").doc(auth.currentUser.uid).set({ items: updated });
    setWishlist(updated);
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

  const isFavoritesEmpty = favorites.length === 0;
  const isWishlistEmpty = wishlist.length === 0;
  const showEmpty = tab === "favorites" ? isFavoritesEmpty : isWishlistEmpty;

  if (showEmpty) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === "dark" ? "light" : "dark"} />
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            onPress={() => setTab("favorites")}
            style={[styles.tabButton, tab === "favorites" && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, { color: tab === "favorites" ? "#FF6600" : colors.subtext }]}>❤️ Favorites</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setTab("wishlist")}
            style={[styles.tabButton, tab === "wishlist" && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, { color: tab === "wishlist" ? "#FF6600" : colors.subtext }]}>🎯 Wishlist</Text>
          </TouchableOpacity>
        </View>
        <Ionicons name={tab === "favorites" ? "heart-outline" : "star-outline"} size={64} color={colors.text} />
        <Text style={[styles.empty, { color: colors.text }]}>
          {tab === "favorites" ? "No favorites yet" : "No wishlist items"}
        </Text>
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
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          onPress={() => setTab("favorites")}
          style={[styles.tabButton, tab === "favorites" && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, { color: tab === "favorites" ? "#FF6600" : colors.subtext }]}>❤️ Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => setTab("wishlist")}
          style={[styles.tabButton, tab === "wishlist" && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, { color: tab === "wishlist" ? "#FF6600" : colors.subtext }]}>🎯 Wishlist</Text>
        </TouchableOpacity>
      </View>

      {tab === "favorites" ? (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isHot = item.price < 10;
            const isLocked = isStoreLocked(item.storeKey, isPremium);
            const isLive = item.timestamp && Date.now() / 1000 - (item.timestamp.seconds || 0) < 600;
            return (
              <DealCard
                deal={item}
                onToggleSave={async () => {}}
                distance={userLocation && item.latitude ? distanceMiles(userLocation, { latitude: item.latitude, longitude: item.longitude || 0 }) : null}
                onOpenMaps={() => openMaps(item)}
                onViewDeal={() => navigation.navigate("DealDetail", { deal: item })}
                isLocked={isLocked}
                isPulsing={isLive}
                theme={theme}
              />
            );
          }}
        />
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.wishlistCard, { borderColor: colors.subtext, backgroundColor: colors.card }]}>
              <Image source={{ uri: item.imageUrl }} style={styles.wishImage} />
              <View style={styles.wishContent}>
                <Text style={[styles.wishTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.wishPrice, { color: colors.accent }]}>
                  Now: ${item.currentPrice.toFixed(2)}
                </Text>
                <View style={styles.targetRow}>
                  <Text style={[styles.label, { color: colors.subtext }]}>Target:</Text>
                  <TextInput
                    style={[styles.priceInput, { color: colors.text, borderColor: colors.subtext }]}
                    keyboardType="decimal-pad"
                    placeholder="$0"
                    value={item.targetPrice ? item.targetPrice.toString() : ""}
                    onChangeText={(val) => updateWishlistTarget(item.id, parseFloat(val) || 0)}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={() => removeWishlistItem(item.id)}>
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1 },
  tabContainer: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  tabButton: { paddingBottom: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#FF6600" },
  tabLabel: { fontSize: 14, fontWeight: "700" },
  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  empty: { fontSize: 16, marginTop: 12, textAlign: "center" },
  exploreButton: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  exploreText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  tagBase: { fontSize: 10, fontWeight: "700" },
  wishlistCard: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  wishImage: { width: 70, height: 70, borderRadius: 8 },
  wishContent: { flex: 1, gap: 6 },
  wishTitle: { fontSize: 13, fontWeight: "600" },
  wishPrice: { fontSize: 12, fontWeight: "700" },
  targetRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 11 },
  priceInput: { flex: 1, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4, borderWidth: 1, fontSize: 11 },
});
