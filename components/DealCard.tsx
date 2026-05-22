// flashradar/components/DealCard.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Image, Pressable,
  TouchableOpacity, Alert, Linking, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";

/* ─── Types ──────────────────────────────────────────────────── */

export type Deal = {
  id: string;
  title: string;
  store?: string;
  storeKey?: string;
  price?: number | null;
  originalPrice?: number | null;
  discountPercent?: number | null;
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
  dealScore?: number | null;
  asin?: string | null;
  publishedAt?: any;
  createdAt?: any;
  couponCode?: string | null;
  promoCode?: string | null;
  resaleIntel?: {
    profitPotential: number;
    roiPercent: number;
    demandLevel: string;
  } | null;
};

type Props = {
  deal: Deal;
  onPress?: () => void;
  onSaveToggle?: () => void;
  darkMode?: boolean;
  blurred?: boolean;
};

/* ─── Helpers ────────────────────────────────────────────────── */

const ACCENT = "#FF7A00";

function getScoreColor(score: number): string {
  if (score >= 90) return "#a855f7";
  if (score >= 75) return "#FF7A00";
  return "#eab308";
}

function getInitialImage(deal: Deal): string | null {
  const dbImage = deal.imageUrl || deal.image || null;
  const urlForAsin = deal.url || deal.affiliateUrl || deal.merchantUrl || "";
  const isAmazon = (deal.store || deal.storeKey || "").toLowerCase().includes("amazon");
  const asinMatch = urlForAsin.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/)?.[1];
  const asin = deal.asin || asinMatch;

  if (isAmazon && asin && (!dbImage || dbImage.includes("placeholder"))) {
    return `https://images-na.ssl-images-amazon.com/images/P/${asin.toUpperCase()}.01._AC_SL500_.jpg`;
  }
  if (dbImage?.includes("images-na.ssl-images-amazon.com")) {
    return dbImage.replace("images-na.ssl-images-amazon.com", "m.media-amazon.com");
  }
  return dbImage;
}

/* ─── Component ──────────────────────────────────────────────── */

export default function DealCard({
  deal, onPress, onSaveToggle, darkMode = true, blurred = false,
}: Props) {
  const [imageError, setImageError] = useState(false);
  const [displayImage, setDisplayImage] = useState<string | null>(getInitialImage(deal));
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState<boolean>(!!deal.isSaved);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalSaved(!!deal.isSaved);
  }, [deal.isSaved]);

  useEffect(() => {
    setDisplayImage(getInitialImage(deal));
    setImageError(false);
  }, [deal.id]);

  // Velocity signals — matching web logic
  const publishedMs = deal.publishedAt?.seconds
    ? deal.publishedAt.seconds * 1000
    : deal.createdAt?.seconds
    ? deal.createdAt.seconds * 1000
    : Date.now();
  const isJustIn = Date.now() - publishedMs < 1_800_000; // 30 min
  const isMajorSteal = (deal.discountPercent ?? 0) > 40;

  const displayScore = deal.dealScore ?? 70;
  const formattedScore = (displayScore / 10).toFixed(1);
  const scoreColor = getScoreColor(displayScore);

  const dealUrl = deal.affiliateUrl || deal.merchantUrl || deal.url || null;
  const couponCode = deal.couponCode || deal.promoCode || null;

  // Has resale intel
  const hasFlipIntel =
    deal.resaleIntel &&
    typeof deal.resaleIntel.profitPotential === "number" &&
    deal.resaleIntel.profitPotential > 0;

  const toggleFavorite = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to save favorites.");
      return;
    }
    const ref = db
      .collection("users")
      .doc(user.uid)
      .collection("favorites")
      .doc(deal.id);
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
      setLocalSaved(localSaved); // revert
    } finally {
      setSaving(false);
    }
  }, [deal, localSaved]);

  const handleCopyCode = () => {
    if (!couponCode) return;
    // React Native doesn't have clipboard built-in — use expo-clipboard
    try {
      const Clipboard = require("expo-clipboard");
      Clipboard.setStringAsync(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <Pressable
      onPress={blurred ? () => {} : onPress}
      style={[
        styles.card,
        deal.rare && styles.rareCard,
        { backgroundColor: darkMode ? "#09090b" : "#fff" },
      ]}
    >
      {/* ── IMAGE ────────────────────────────────────────────── */}
      <View style={styles.imageWrap}>
        {displayImage && !imageError ? (
          <Image
            source={{ uri: displayImage }}
            style={[styles.image, blurred && styles.blurred]}
            resizeMode="contain"
            onError={() => {
              if (displayImage !== (deal.imageUrl || deal.image)) {
                setDisplayImage(deal.imageUrl || deal.image || null);
              } else {
                setImageError(true);
              }
            }}
          />
        ) : (
          <View style={styles.imageFallback}>
            <Ionicons name="image-outline" size={32} color="#555" />
            <Text style={styles.imageFallbackText}>Image Unavailable</Text>
          </View>
        )}

        {/* Velocity badges — top right */}
        <View style={styles.badgeStack}>
          {isJustIn && (
            <View style={[styles.badge, { backgroundColor: "#2563eb" }]}>
              <Ionicons name="flash" size={8} color="#fff" />
              <Text style={styles.badgeText}>JUST IN</Text>
            </View>
          )}
          {isMajorSteal && !isJustIn && (
            <View style={[styles.badge, { backgroundColor: "#ea580c" }]}>
              <Ionicons name="trending-up-outline" size={8} color="#fff" />
              <Text style={styles.badgeText}>HOT DROP</Text>
            </View>
          )}
          {deal.rare && (
            <View style={[styles.badge, { backgroundColor: "#9333ea" }]}>
              <Text style={styles.badgeText}>RARE FIND</Text>
            </View>
          )}
        </View>

        {/* Save button — top left */}
        <TouchableOpacity
          onPress={onSaveToggle ?? toggleFavorite}
          disabled={saving}
          style={styles.saveBtn}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={localSaved ? "heart" : "heart-outline"}
              size={16}
              color={localSaved ? "#ef4444" : "#fff"}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ── CONTENT ──────────────────────────────────────────── */}
      <View style={[styles.content, { backgroundColor: darkMode ? "#09090b" : "#fff" }]}>

        {/* Store + Deal Score row */}
        <View style={styles.metaRow}>
          <View style={styles.storeBadge}>
            <Ionicons name="storefront-outline" size={10} color="#999" />
            <Text style={styles.storeText}>
              {(deal.store || deal.storeKey || "RETAILER").toUpperCase()}
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={scoreColor} />
            <Text style={[styles.scoreText, { color: scoreColor }]}>{formattedScore}</Text>
          </View>
        </View>

        {/* Title */}
        <Text
          style={[styles.title, { color: darkMode ? "#f4f4f5" : "#111" }]}
          numberOfLines={2}
        >
          {(deal.title || "").toUpperCase()}
        </Text>

        {/* Flip Intel strip — matches web AI insight */}
        {hasFlipIntel && !blurred && (
          <View style={styles.flipStrip}>
            <Ionicons name="alert-circle-outline" size={11} color={ACCENT} />
            <Text style={styles.flipText}>
              Flip potential: +${deal.resaleIntel!.profitPotential} · {deal.resaleIntel!.demandLevel} demand · {deal.resaleIntel!.roiPercent}% ROI
            </Text>
          </View>
        )}

        {/* Coupon code strip */}
        {couponCode && !blurred && (
          <TouchableOpacity style={styles.couponStrip} onPress={handleCopyCode}>
            <Ionicons name="pricetag-outline" size={11} color="#2563eb" />
            <Text style={styles.couponCode}>{couponCode}</Text>
            <Ionicons
              name={copied ? "checkmark-outline" : "copy-outline"}
              size={11}
              color={copied ? "#22c55e" : "#2563eb"}
            />
            <Text style={styles.couponCopy}>{copied ? "Copied!" : "Tap to copy"}</Text>
          </TouchableOpacity>
        )}

        {/* Price row */}
        <View style={styles.priceRow}>
          <View>
            <View style={styles.priceInner}>
              <Text style={[styles.price, { color: darkMode ? "#fff" : "#111" }]}>
                {deal.price != null ? `$${Number(deal.price).toFixed(2)}` : "See deal"}
              </Text>
              {(deal.discountPercent ?? 0) > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>-{deal.discountPercent}%</Text>
                </View>
              )}
            </View>
            {deal.originalPrice != null && deal.price != null && deal.originalPrice > deal.price && (
              <Text style={styles.originalPrice}>
                EST. VALUE: <Text style={styles.strikethrough}>${Number(deal.originalPrice).toFixed(2)}</Text>
              </Text>
            )}
          </View>

          {/* GRAB DEAL button */}
          {dealUrl && !blurred ? (
            <TouchableOpacity
              style={styles.grabBtn}
              onPress={() => Linking.openURL(dealUrl)}
            >
              <Text style={styles.grabText}>GRAB DEAL</Text>
              <Ionicons name="arrow-up-circle-outline" size={13} color="#000" />
            </TouchableOpacity>
          ) : blurred ? (
            <View style={[styles.grabBtn, { backgroundColor: "#333" }]}>
              <Ionicons name="lock-closed-outline" size={13} color="#888" />
              <Text style={[styles.grabText, { color: "#888" }]}>PREMIUM</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  rareCard: {
    borderColor: "rgba(168,85,247,0.4)",
  },

  // Image
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#fff",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  blurred: {
    opacity: 0.15,
  },
  imageFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    width: "100%",
  },
  imageFallbackText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#999",
    textTransform: "uppercase",
    marginTop: 4,
  },

  // Badges
  badgeStack: {
    position: "absolute",
    top: 8,
    right: 8,
    gap: 4,
    alignItems: "flex-end",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Save
  saveBtn: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 999,
    padding: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // Content
  content: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  storeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  storeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#d4d4d8",
    letterSpacing: 1,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "900",
  },

  // Title
  title: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    lineHeight: 17,
    marginBottom: 8,
    minHeight: 34,
  },

  // Flip intel
  flipStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 7,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
    marginBottom: 8,
  },
  flipText: {
    fontSize: 9,
    color: "#a1a1aa",
    fontWeight: "600",
    flex: 1,
    lineHeight: 13,
  },

  // Coupon
  couponStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(37,99,235,0.1)",
    padding: 7,
    borderRadius: 6,
    marginBottom: 8,
  },
  couponCode: {
    fontSize: 10,
    fontWeight: "900",
    color: "#60a5fa",
    flex: 1,
    letterSpacing: 1,
  },
  couponCopy: {
    fontSize: 9,
    color: "#60a5fa",
    fontWeight: "700",
  },

  // Price
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 8,
  },
  priceInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  price: {
    fontSize: 22,
    fontWeight: "900",
  },
  discountBadge: {
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#22c55e",
  },
  originalPrice: {
    fontSize: 9,
    color: "#71717a",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },

  // Grab deal
  grabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  grabText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.5,
  },
});