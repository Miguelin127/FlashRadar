// flashradar/components/DealCard.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Image, Pressable,
  TouchableOpacity, Alert, Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";

export type Deal = {
  id: string;
  title: string;
  store?: string;
  price?: number | null;
  originalPrice?: number | null;
  image?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  merchantUrl?: string | null;
  affiliateUrl?: string | null;
  hot?: boolean;
  rare?: boolean;
  lightning?: boolean;
  live?: boolean;
  isSaved?: boolean;
};

type Props = {
  deal: Deal;
  onPress?: () => void;
  onSaveToggle?: () => void;
  darkMode?: boolean;
};

export default function DealCard({ deal, onPress, onSaveToggle, darkMode = true }: Props) {
  const text = darkMode ? "#fff" : "#111";
  const subText = darkMode ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)";
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState<boolean>(!!deal.isSaved);

  useEffect(() => {
    setLocalSaved(!!deal.isSaved);
  }, [deal.isSaved]);

  const rawImage =
    deal.image && deal.image.length > 0 ? deal.image
    : deal.imageUrl && deal.imageUrl.length > 0 ? deal.imageUrl
    : null;

  const imageUri = rawImage?.includes("amazon")
    ? rawImage.replace("images-na.ssl-images-amazon.com", "m.media-amazon.com")
    : rawImage;

  // ── Affiliate URL first — always send tracked links ──────────────────────
  const dealUrl = deal.affiliateUrl || deal.merchantUrl || deal.url || null;

  const toggleFavorite = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to save favorites.");
      return;
    }

    // ── Compat SDK — matches db instance from firebaseConfig.ts ─────────────
    const ref = db.collection("users").doc(user.uid).collection("favorites").doc(deal.id);

    try {
      setSaving(true);
      const next = !localSaved;
      setLocalSaved(next);
      if (!next) {
        await ref.delete();
      } else {
        await ref.set({ ...deal, isSaved: true }, { merge: true });
      }
    } catch (err) {
      console.error("[DealCard] toggleFavorite error:", err);
      setLocalSaved(localSaved); // revert on error
    } finally {
      setSaving(false);
    }
  }, [deal, localSaved]);

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: darkMode ? "#111" : "#fff" }]}>
      <View style={styles.row}>
        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              fadeDuration={0}
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="image-outline" size={28} color={darkMode ? "#555" : "#999"} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: text }]} numberOfLines={2}>
            {deal.title}
          </Text>
          {deal.store && (
            <Text style={[styles.store, { color: subText }]}>{deal.store}</Text>
          )}
          <View style={styles.priceRow}>
            {deal.price != null ? (
              <>
                <Text style={styles.price}>${deal.price.toFixed(2)}</Text>
                {deal.originalPrice && deal.originalPrice > deal.price && (
                  <Text style={styles.originalPrice}>
                    ${deal.originalPrice.toFixed(2)}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.priceUnavailable}>See deal</Text>
            )}
          </View>
          {dealUrl && (
            <TouchableOpacity onPress={() => Linking.openURL(dealUrl)} style={styles.openBtn}>
              <Text style={styles.openText}>Buy Now</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={onSaveToggle ?? toggleFavorite}
          disabled={saving}
          style={styles.heart}
        >
          <Ionicons
            name={localSaved ? "heart" : "heart-outline"}
            size={22}
            color={localSaved ? "#FF3B30" : darkMode ? "#888" : "#444"}
          />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 12, marginBottom: 12 },
  row: { flexDirection: "row" },
  imageContainer: { width: 95, height: 95, marginRight: 12 },
  image: { width: "100%", height: "100%", borderRadius: 12, backgroundColor: "#000" },
  placeholder: { width: "100%", height: "100%", borderRadius: 12, backgroundColor: "#1c1c1c", justifyContent: "center", alignItems: "center" },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  store: { fontSize: 12, marginBottom: 6 },
  priceRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  price: { fontSize: 18, fontWeight: "700", color: "#FF8C00", marginRight: 8 },
  originalPrice: { fontSize: 13, textDecorationLine: "line-through", color: "#777" },
  priceUnavailable: { color: "#777" },
  openBtn: { backgroundColor: "#FF8C00", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, alignSelf: "flex-start" },
  openText: { color: "#000", fontWeight: "700" },
  heart: { marginLeft: 8, alignSelf: "flex-start" },
});