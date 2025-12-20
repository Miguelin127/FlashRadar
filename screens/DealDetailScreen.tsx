import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../firebaseConfig";
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { usePulseAnimation } from "../FlashRadar/hooks/usePulseAnimation";

type DealDetailRouteProp = RouteProp<RootStackParamList, "DealDetail">;

export default function DealDetailScreen() {
  const route = useRoute<DealDetailRouteProp>();
  const navigation = useNavigation();
  const { colors, theme } = useTheme();
  const isDark = theme === "dark";

  const deal = route.params?.deal;
  const [isSaved, setIsSaved] = useState(deal?.isSaved || false);
  const { triggerPulse, ringStyle } = usePulseAnimation(500, 1.25);

  if (!deal) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No deal data.</Text>
      </View>
    );
  }

  /* ---------------- PRICE COMPARISON ---------------- */
  const priceComparison = useMemo(() => {
    if (!deal.priceComparison) return [];
    return Object.entries(deal.priceComparison) as [string, number][];
  }, [deal.priceComparison]);

  const bestPrice = useMemo(() => {
    if (!priceComparison.length) return null;
    return priceComparison.reduce((a, b) => (a[1] < b[1] ? a : b));
  }, [priceComparison]);

  /* ---------------- NEARBY STORES ---------------- */
  const nearbyStores = useMemo(() => {
    if (!deal.nearbyStores) return [];
    return [...deal.nearbyStores].sort(
      (a: any, b: any) => a.distance - b.distance
    );
  }, [deal.nearbyStores]);

  const lowInventory = nearbyStores.some(
    (s: any) => s.inventory !== undefined && s.inventory <= 2
  );

  /* ---------------- AI BUY / WAIT VERDICT ---------------- */
  const verdict = useMemo(() => {
    if (deal.price && deal.historyLow && deal.price <= deal.historyLow) {
      return {
        label: "BUY NOW",
        reason: "Lowest price recorded",
        color: "#1E9E39",
        icon: "flash",
      };
    }

    if (lowInventory) {
      return {
        label: "BUY NOW",
        reason: "Very limited inventory nearby",
        color: "#FF3B30",
        icon: "warning",
      };
    }

    if (deal.rare && deal.isHot) {
      return {
        label: "BUY NOW",
        reason: "Rare + Hot combo",
        color: "#8E44AD",
        icon: "sparkles",
      };
    }

    if (deal.price && deal.historyAvg && deal.price > deal.historyAvg) {
      return {
        label: "WAIT",
        reason: "Price above historical average",
        color: "#FF9500",
        icon: "time",
      };
    }

    return {
      label: "WATCH",
      reason: "Insufficient price history",
      color: "#0A84FF",
      icon: "eye",
    };
  }, [deal, lowInventory]);

  const openMaps = (lat: number, lng: number, label?: string) => {
    const url = Platform.select({
      ios: `maps://?q=${label || "Store"}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${label || "Store"}`,
    });
    if (url) Linking.openURL(url);
  };

  const openKeepa = () => {
    if (!deal.asin) return;
    Linking.openURL(`https://keepa.com/#!product/1-${deal.asin}`);
  };

  const toggleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;

    triggerPulse();
    const ref = doc(db, "users", user.uid, "favorites", deal.id);

    if (isSaved) await deleteDoc(ref);
    else await setDoc(ref, deal, { merge: true });

    setIsSaved(!isSaved);
  };

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: colors.background },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {deal.image && (
          <Image source={{ uri: deal.image }} style={styles.image} />
        )}

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {deal.title}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {deal.price ? `$${deal.price}` : "N/A"}
            </Text>
            <Text style={[styles.store, { color: colors.text }]}>
              {deal.store}
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={toggleSave}>
              <Animated.View style={ringStyle}>
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={26}
                  color="#FF6600"
                />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Share.share({ message: deal.url || deal.title })
              }
            >
              <Ionicons
                name="share-outline"
                size={26}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* AI VERDICT */}
        <View
          style={[
            styles.verdictCard,
            {
              borderColor: verdict.color,
              backgroundColor: isDark ? "#1A1A1A" : "#FAFAFA",
            },
          ]}
        >
          <Ionicons
            name={verdict.icon as any}
            size={22}
            color={verdict.color}
          />
          <View>
            <Text
              style={[styles.verdictTitle, { color: verdict.color }]}
            >
              {verdict.label}
            </Text>
            <Text
              style={[
                styles.verdictReason,
                { color: colors.text },
              ]}
            >
              {verdict.reason}
            </Text>
          </View>
        </View>

        {/* PRICE COMPARISON */}
        {priceComparison.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: isDark ? "#1A1A1A" : "#F6F6F6" },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.text }]}
            >
              Price comparison
            </Text>

            {priceComparison.map(([store, price]) => (
              <View key={store} style={styles.compareRow}>
                <Text
                  style={[styles.compareStore, { color: colors.text }]}
                >
                  {store}
                </Text>
                <Text
                  style={[
                    styles.comparePrice,
                    bestPrice?.[0] === store && styles.bestPrice,
                  ]}
                >
                  ${price}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* KEEPA */}
        {deal.isPremium && deal.asin && (
          <TouchableOpacity
            style={[
              styles.keepaBtn,
              { backgroundColor: isDark ? "#2C2C2C" : "#2C2C2C" },
            ]}
            onPress={openKeepa}
          >
            <Ionicons name="stats-chart" size={18} color="#fff" />
            <Text style={styles.keepaText}>
              View Keepa Price History
            </Text>
          </TouchableOpacity>
        )}

        {/* NEARBY STORES */}
        {nearbyStores.length > 0 && (
          <View
            style={[
              styles.card,
              { backgroundColor: isDark ? "#1A1A1A" : "#F6F6F6" },
            ]}
          >
            <Text
              style={[styles.sectionTitle, { color: colors.text }]}
            >
              Nearby stores
            </Text>

            {nearbyStores.map((store: any) => (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.storeRow,
                  { borderColor: isDark ? "#333" : "#ddd" },
                ]}
                onPress={() =>
                  openMaps(store.latitude, store.longitude, store.name)
                }
              >
                <View>
                  <Text
                    style={[styles.storeName, { color: colors.text }]}
                  >
                    {store.name}
                  </Text>
                  <Text
                    style={[styles.storeMeta, { color: colors.text }]}
                  >
                    {store.distance.toFixed(1)} mi
                    {store.inventory !== undefined &&
                      ` • ${store.inventory} left`}
                  </Text>
                </View>
                <Ionicons
                  name="navigate"
                  size={20}
                  color="#FF6600"
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* STICKY CTA */}
      <View
        style={[
          styles.sticky,
          { backgroundColor: isDark ? "#000" : "#000" },
        ]}
      >
        <TouchableOpacity
          style={styles.cta}
          onPress={() =>
            deal.latitude && deal.longitude
              ? openMaps(deal.latitude, deal.longitude, deal.store)
              : Linking.openURL(deal.url)
          }
        >
          <Ionicons
            name={deal.latitude ? "car" : "link-outline"}
            size={18}
            color="#fff"
          />
          <Text style={styles.ctaText}>
            {deal.latitude ? "Get Directions" : "View Deal"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 140 },
  image: { width: "100%", height: 260 },

  header: { padding: 18 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6 },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  price: { fontSize: 22, fontWeight: "800", color: "#FF6600" },
  store: { fontSize: 15, opacity: 0.7 },

  actions: { flexDirection: "row", gap: 20, marginTop: 12 },

  verdictCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
  },

  verdictTitle: { fontSize: 16, fontWeight: "900" },
  verdictReason: { fontSize: 14, opacity: 0.85 },

  sectionTitle: { fontWeight: "800", marginBottom: 10 },

  card: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
  },

  compareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },

  compareStore: { fontWeight: "600" },
  comparePrice: { fontWeight: "700", color: "#FF6600" },
  bestPrice: { color: "#1E9E39" },

  keepaBtn: {
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  keepaText: { color: "#fff", fontWeight: "800" },

  storeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },

  storeName: { fontWeight: "700" },
  storeMeta: { fontSize: 13, opacity: 0.75 },

  sticky: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },

  cta: {
    backgroundColor: "#FF6600",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
