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
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Deal } from "../components/DealCard";

/* ───────────────────── TYPES ───────────────────── */

type DealWithHistory = Deal & {
  originalPrice?: number | null;
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

  const discountPercent =
    currentPrice && oldPrice && oldPrice > currentPrice
      ? Math.round(((oldPrice - currentPrice) / oldPrice) * 100)
      : null;

  return (
    <ScrollView style={styles.container}>
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
      </View>
    </ScrollView>
  );
}

/* ───────────────────── STYLES ───────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

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
