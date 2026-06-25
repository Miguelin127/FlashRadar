import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Deal } from "../components/DealCard";
import { useAuth } from "../context/AuthContext";

/* ───────────────────── TYPES ───────────────────── */

type DealWithHistory = Deal & {
  originalPrice?: number | null;
  discountPercent?: number | null;
  avg30?: number | null;
  avg60?: number | null;
  avg90?: number | null;
  timestamp?: any;
};

type Props = {
  route: RouteProp<{ params: { deal: DealWithHistory } }, "params">;
};

/* ───────────────────── HELPERS ───────────────────── */

function timeAgo(timestamp?: any) {
  if (!timestamp?.seconds) return "Recently";

  const diffMs = Date.now() - timestamp.seconds * 1000;
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function dealStrength(deal: Deal) {
  if (deal.lightning) return { label: "Lightning Deal", color: "#FF3B30" };
  if (deal.rare) return { label: "Rare Find", color: "#9B59B6" };
  if (deal.hot) return { label: "Hot Deal", color: "#FF7A00" };
  return { label: "Standard Deal", color: "#777" };
}

function normalizeImage(url?: string | null) {
  if (!url || typeof url !== "string") return null;
  return url.replace(/^http:\/\//i, "https://");
}

/* ───────────────────── SCREEN ───────────────────── */

export default function DealDetailScreen({ route }: Props) {
  const { deal } = route.params;
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // ✅ FIXED IMAGE RESOLUTION
  const imageUri = useMemo(() => {
    return (
      normalizeImage(deal.imageUrl) ||
      normalizeImage(deal.image) ||
      null
    );
  }, [deal.image, deal.imageUrl]);

  const dealUrl =
    deal.merchantUrl || deal.affiliateUrl || deal.url || null;

  const strength = dealStrength(deal);

  const currentPrice =
    typeof deal.price === "number" && deal.price > 0
      ? deal.price
      : null;

  const historyPrices = [
    deal.originalPrice,
    deal.avg30,
    deal.avg60,
    deal.avg90,
  ].filter((p): p is number => typeof p === "number" && p > 0);

  const oldPrice =
    historyPrices.length && currentPrice
      ? Math.max(...historyPrices)
      : null;

  // Prefer the deal's own discountPercent; fall back to computed from history
  const computedDiscount =
    currentPrice && oldPrice && oldPrice > currentPrice
      ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
      : null;

  const discountPercent =
    typeof deal.discountPercent === "number" && deal.discountPercent > 0
      ? Math.round(deal.discountPercent)
      : computedDiscount;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* HEADER BAR */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {deal.store}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* IMAGE */}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={48} color="#555" />
            <Text style={styles.imageFallbackText}>
              Image unavailable
            </Text>
          </View>
        )}

        <View style={styles.content}>
          {/* TITLE */}
          <Text style={styles.title}>{deal.title}</Text>

          {/* STORE */}
          <Text style={styles.store}>{deal.store}</Text>

          {/* DEAL STRENGTH */}
          <View style={styles.strengthRow}>
            <Ionicons name="flash" size={16} color={strength.color} />
            <Text style={[styles.strengthText, { color: strength.color }]}>
              {strength.label}
            </Text>
          </View>

          {/* PRICE */}
          <View style={styles.priceRow}>
            {currentPrice ? (
              <Text style={styles.price}>
                ${currentPrice.toFixed(2)}
              </Text>
            ) : (
              <Text style={styles.priceUnavailable}>See deal</Text>
            )}

            {oldPrice && discountPercent && (
              <>
                <Text style={styles.originalPrice}>
                  ${oldPrice.toFixed(2)}
                </Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {discountPercent}% OFF
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* META */}
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color="#aaa" />
            <Text style={styles.metaText}>
              Posted {timeAgo(deal.timestamp)}
            </Text>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.description}>
            This deal is live and may sell out quickly. Pricing and availability
            can change at any time.
          </Text>

          {/* CTA */}
          {dealUrl && (
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => Linking.openURL(dealUrl)}
            >
              <Text style={styles.openText}>Get Deal</Text>
            </TouchableOpacity>
          )}

          {/* GUEST SIGN-IN NUDGE */}
          {!user && (
            <TouchableOpacity
              style={styles.signInNudge}
              onPress={() => navigation.navigate("Login")}
            >
              <Ionicons name="notifications-outline" size={18} color="#FF7A00" />
              <Text style={styles.signInText}>
                Sign in to save deals & get price alerts
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#FF7A00" />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────── STYLES ───────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  signInNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF7A00",
    backgroundColor: "rgba(255,122,0,0.08)",
  },
  signInText: { flex: 1, color: "#FF7A00", fontWeight: "700", fontSize: 14 },
  container: { flex: 1, backgroundColor: "#000" },

  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#000",
  },

  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  image: {
    width: "100%",
    height: 320,
    resizeMode: "contain",
    backgroundColor: "#111",
  },

  imageFallback: {
    height: 320,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },

  imageFallbackText: {
    marginTop: 8,
    color: "#666",
    fontSize: 13,
  },

  content: { padding: 16 },

  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },

  store: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 8,
  },

  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },

  strengthText: {
    fontSize: 13,
    fontWeight: "800",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  price: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FF7A00",
  },

  priceUnavailable: {
    fontSize: 16,
    fontWeight: "700",
    color: "#bbb",
  },

  originalPrice: {
    fontSize: 14,
    color: "#aaa",
    textDecorationLine: "line-through",
  },

  discountBadge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  discountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },

  metaText: {
    color: "#aaa",
    fontSize: 12,
  },

  description: {
    color: "#ddd",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },

  openBtn: {
    backgroundColor: "#FF6600",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  openText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
});