// flashradar/components/DealCard.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  discountPercent?: number | null;
  image?: string | null;
  isSaved?: boolean;
  source?: "local" | "online";
};

type Props = {
  deal: Deal;
  onPress?: () => void;
  onSaveToggle?: () => void;
  darkMode?: boolean;
  showOpenDealButton?: boolean;
  compact?: boolean;
};

function normalizeStore(store?: string) {
  return (store || "").trim().toLowerCase();
}

const STORE_FALLBACKS: Record<string, ImageSourcePropType> = {
  walmart: require("../assets/store_fallbacks/walmart.png"),
  target: require("../assets/store_fallbacks/target.png"),
  "home depot": require("../assets/store_fallbacks/homedepot.png"),
  homedepot: require("../assets/store_fallbacks/homedepot.png"),
  amazon: require("../assets/store_fallbacks/amazon.png"),
};

function getFallbackImage(store: string): ImageSourcePropType | null {
  const key = normalizeStore(store);
  if (STORE_FALLBACKS[key]) return STORE_FALLBACKS[key];

  if (key.includes("walmart")) return STORE_FALLBACKS.walmart;
  if (key.includes("target")) return STORE_FALLBACKS.target;
  if (key.includes("home depot") || key.includes("homedepot"))
    return STORE_FALLBACKS["home depot"];
  if (key.includes("amazon")) return STORE_FALLBACKS.amazon;

  return null;
}

export default function DealCard({
  deal,
  onPress,
  onSaveToggle,
  darkMode = true,
  showOpenDealButton = true,
  compact = false,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  const text = darkMode ? "#fff" : "#111";
  const subText = darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.65)";

  // Accept different doc field names if they exist
  const rawImage =
    (deal as any)?.image ??
    (deal as any)?.Image ??
    (deal as any)?.imageUrl ??
    (deal as any)?.ImageUrl ??
    null;

  const imageUri =
    typeof rawImage === "string" && rawImage.trim().length > 0
      ? rawImage.trim()
      : null;

  const fallbackImg = useMemo(() => getFallbackImage(deal.store), [deal.store]);

  const showRemote = !!imageUri && !imgFailed;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, { padding: compact ? 10 : 12 }]}
    >
      <View style={styles.row}>
        {showRemote ? (
          <Image
            source={{ uri: imageUri! }}
            style={[
              styles.image,
              { width: compact ? 58 : 66, height: compact ? 58 : 66 },
            ]}
            onError={() => setImgFailed(true)} // ✅ if remote fails, fall back to store logo
          />
        ) : fallbackImg ? (
          <Image
            source={fallbackImg}
            style={[
              styles.image,
              { width: compact ? 58 : 66, height: compact ? 58 : 66 },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.imageFallback,
              { width: compact ? 58 : 66, height: compact ? 58 : 66 },
            ]}
          >
            <Ionicons name="pricetag" size={22} color={subText} />
          </View>
        )}

        <View style={styles.main}>
          <Text
            style={[styles.title, { color: text }]}
            numberOfLines={compact ? 2 : 3}
          >
            {deal.title}
          </Text>

          <Text style={[styles.store, { color: subText }]} numberOfLines={1}>
            {deal.store}
            {deal.source ? ` • ${deal.source}` : ""}
          </Text>

          <Text style={[styles.price, { color: "#FF7A00" }]}>
            ${Number(deal.price || 0).toFixed(2)}
            {typeof deal.discountPercent === "number"
              ? `  •  ${Math.round(deal.discountPercent)}% off`
              : ""}
          </Text>
        </View>

        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onSaveToggle?.();
          }}
          style={styles.saveBtn}
          hitSlop={10}
        >
          <Ionicons
            name={deal.isSaved ? "heart" : "heart-outline"}
            size={22}
            color={deal.isSaved ? "#FF3B30" : subText}
          />
        </TouchableOpacity>
      </View>

      {showOpenDealButton && (
        <TouchableOpacity
          onPress={onPress}
          style={styles.openBtn}
          activeOpacity={0.9}
        >
          <Text style={styles.openText}>Open Deal</Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  image: {
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  imageFallback: {
    borderRadius: 10,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.9,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  main: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  store: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  price: {
    fontSize: 13,
    fontWeight: "800",
  },
  saveBtn: {
    paddingLeft: 6,
    paddingTop: 2,
  },
  openBtn: {
    marginTop: 10,
    backgroundColor: "#FF6600",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  openText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
});
