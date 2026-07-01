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
  expired?: boolean;
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
  compact?: boolean;
};

/* ─── Helpers ────────────────────────────────────────────────── */

const ACCENT = "#FF7A00";

function getScoreColor(score: number) {
  if (score >= 90) return "#a855f7";
  if (score >= 75) return ACCENT;
  return "#eab308";
}

function resolveImage(deal: Deal): string | null {
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
  deal, onPress, onSaveToggle, darkMode = true, blurred = false, compact = false,
}: Props) {
  const [imageError, setImageError] = useState(false);
  const [displayImage, setDisplayImage] = useState<string | null>(resolveImage(deal));
  const [saving, setSaving] = useState(false);
  const [localSaved, setLocalSaved] = useState(!!deal.isSaved);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setLocalSaved(!!deal.isSaved); }, [deal.isSaved]);
  useEffect(() => { setDisplayImage(resolveImage(deal)); setImageError(false); }, [deal.id]);

  const publishedMs = deal.publishedAt?.seconds
    ? deal.publishedAt.seconds * 1000
    : deal.createdAt?.seconds ? deal.createdAt.seconds * 1000 : Date.now();
  const isJustIn = Date.now() - publishedMs < 1_800_000;
  const isMajorSteal = (deal.discountPercent ?? 0) > 40;
  const isExpired = !!deal.expired;

  const displayScore = deal.dealScore ?? 70;
  const scoreColor = getScoreColor(displayScore);

  function isValidDealUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    try {
      const u = new URL(url);
      if (u.pathname.includes("/c//")) return false;
      if (u.hostname.includes("slickdeals.net")) return false;
      return true;
    } catch { return false; }
  }

  const dealUrl = [deal.affiliateUrl, deal.merchantUrl, deal.url].find(isValidDealUrl) || null;
  const couponCode = deal.couponCode || deal.promoCode || null;
  const hasFlipIntel = deal.resaleIntel && (deal.resaleIntel.profitPotential ?? 0) > 0;

  const toggleFavorite = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { Alert.alert("Sign in required", "Please sign in to save favorites."); return; }
    const ref = db.collection("users").doc(user.uid).collection("favorites").doc(deal.id);
    try {
      setSaving(true);
      const next = !localSaved;
      setLocalSaved(next);
      if (!next) await ref.delete();
      else await ref.set({ ...deal, isSaved: true }, { merge: true });
    } catch { setLocalSaved(localSaved); }
    finally { setSaving(false); }
  }, [deal, localSaved]);

  const handleCopyCode = async () => {
    if (!couponCode) return;
    try {
      const Clipboard = require("expo-clipboard");
      await Clipboard.setStringAsync(couponCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenDeal = () => {
    if (blurred || !dealUrl || isExpired) return;
    Linking.openURL(dealUrl);
  };

  // ── COMPACT / GRID MODE ───────────────────────────────────────
  if (compact) {
    return (
      <Pressable
        onPress={isExpired ? () => {} : onPress}
        style={[
          cs.card,
          deal.rare && cs.rareCard,
          isExpired && cs.expiredCard,
          { backgroundColor: darkMode ? "#0f0f0f" : "#fff" },
        ]}
      >
        {/* Discount badge */}
        {(deal.discountPercent ?? 0) > 0 && !isExpired && (
          <View style={cs.discountTag}>
            <Text style={cs.discountTagText}>-{deal.discountPercent}%</Text>
          </View>
        )}

        {/* Image */}
        <View style={cs.imageWrap}>
          {displayImage && !imageError ? (
            <Image
              source={{ uri: displayImage }}
              style={[cs.image, (blurred || isExpired) && cs.blurred]}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={cs.imageFallback}>
              <Ionicons name="image-outline" size={24} color="#555" />
            </View>
          )}

          {/* Save */}
          <TouchableOpacity
            onPress={onSaveToggle ?? toggleFavorite}
            disabled={saving}
            style={cs.saveBtn}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name={localSaved ? "heart" : "heart-outline"} size={13} color={localSaved ? "#ef4444" : "#fff"} />
            }
          </TouchableOpacity>

          {/* Badge strip */}
          <View style={cs.badgeRow}>
            {isExpired && <View style={[cs.badge, { backgroundColor: "#555" }]}><Text style={cs.badgeTxt}>EXPIRED</Text></View>}
            {!isExpired && isJustIn && <View style={[cs.badge, { backgroundColor: "#2563eb" }]}><Text style={cs.badgeTxt}>JUST IN</Text></View>}
            {!isExpired && deal.rare && <View style={[cs.badge, { backgroundColor: "#9333ea" }]}><Text style={cs.badgeTxt}>RARE</Text></View>}
            {!isExpired && isMajorSteal && !isJustIn && !deal.rare && <View style={[cs.badge, { backgroundColor: "#ea580c" }]}><Text style={cs.badgeTxt}>HOT</Text></View>}
          </View>
        </View>

        {/* Content */}
        <View style={cs.content}>
          <Text style={[cs.store, { color: darkMode ? "#888" : "#999" }]}>
            {(deal.store || "").toUpperCase()}
          </Text>
          <Text style={[cs.title, { color: isExpired ? "#555" : darkMode ? "#f4f4f5" : "#111" }]} numberOfLines={2}>
            {deal.title}
          </Text>

          <View style={cs.priceRow}>
            <Text style={[cs.price, isExpired && { color: "#555" }]}>
              {deal.price != null ? `$${Number(deal.price).toFixed(2)}` : "—"}
            </Text>
            {deal.originalPrice != null && deal.price != null && deal.originalPrice > deal.price && (
              <Text style={cs.original}>${Number(deal.originalPrice).toFixed(2)}</Text>
            )}
          </View>

          {isExpired ? (
            <View style={cs.expiredBtn}>
              <Ionicons name="time-outline" size={11} color="#666" />
              <Text style={cs.expiredBtnText}>DEAL EXPIRED</Text>
            </View>
          ) : couponCode && !blurred ? (
            <TouchableOpacity style={cs.codeBtn} onPress={handleCopyCode}>
              <Ionicons name={copied ? "checkmark" : "pricetag-outline"} size={11} color={copied ? "#22c55e" : "#000"} />
              <Text style={cs.codeBtnText}>{copied ? "Copied!" : "Get Code"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[cs.grabBtn, blurred && cs.grabBtnLocked]}
              onPress={handleOpenDeal}
            >
              {blurred
                ? <><Ionicons name="lock-closed-outline" size={11} color="#888" /><Text style={[cs.grabText, { color: "#888" }]}>PREMIUM</Text></>
                : <><Text style={cs.grabText}>GRAB DEAL</Text><Ionicons name="arrow-forward" size={11} color="#000" /></>
              }
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    );
  }

  // ── FULL / LIST MODE ─────────────────────────────────────────
  return (
    <Pressable
      onPress={isExpired ? () => {} : onPress}
      style={[
        fs.card,
        deal.rare && fs.rareCard,
        isExpired && fs.expiredCard,
        { backgroundColor: darkMode ? "#09090b" : "#fff" },
      ]}
    >
      {/* IMAGE */}
      <View style={fs.imageWrap}>
        {displayImage && !imageError ? (
          <Image
            source={{ uri: displayImage }}
            style={[fs.image, (blurred || isExpired) && fs.blurred]}
            resizeMode="contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={fs.imageFallback}>
            <Ionicons name="image-outline" size={32} color="#555" />
            <Text style={fs.imageFallbackText}>Image Unavailable</Text>
          </View>
        )}

        <View style={fs.badgeStack}>
          {isExpired && (
            <View style={[fs.badge, { backgroundColor: "#555" }]}>
              <Ionicons name="time-outline" size={8} color="#fff" />
              <Text style={fs.badgeText}>EXPIRED</Text>
            </View>
          )}
          {!isExpired && isJustIn && (
            <View style={[fs.badge, { backgroundColor: "#2563eb" }]}>
              <Ionicons name="flash" size={8} color="#fff" />
              <Text style={fs.badgeText}>JUST IN</Text>
            </View>
          )}
          {!isExpired && isMajorSteal && !isJustIn && (
            <View style={[fs.badge, { backgroundColor: "#ea580c" }]}>
              <Text style={fs.badgeText}>HOT DROP</Text>
            </View>
          )}
          {!isExpired && deal.rare && (
            <View style={[fs.badge, { backgroundColor: "#9333ea" }]}>
              <Text style={fs.badgeText}>RARE FIND</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={onSaveToggle ?? toggleFavorite}
          disabled={saving}
          style={fs.saveBtn}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name={localSaved ? "heart" : "heart-outline"} size={16} color={localSaved ? "#ef4444" : "#fff"} />
          }
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      <View style={[fs.content, { backgroundColor: darkMode ? "#09090b" : "#fff" }]}>
        <View style={fs.metaRow}>
          <View style={fs.storeBadge}>
            <Ionicons name="storefront-outline" size={10} color="#999" />
            <Text style={fs.storeText}>{(deal.store || deal.storeKey || "RETAILER").toUpperCase()}</Text>
          </View>
          <View style={fs.scoreRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={scoreColor} />
            <Text style={[fs.scoreText, { color: scoreColor }]}>
              {(displayScore / 10).toFixed(1)}
            </Text>
          </View>
        </View>

        <Text style={[fs.title, { color: isExpired ? "#555" : darkMode ? "#f4f4f5" : "#111" }]} numberOfLines={2}>
          {(deal.title || "").toUpperCase()}
        </Text>

        {hasFlipIntel && !blurred && !isExpired && (
          <View style={fs.flipStrip}>
            <Ionicons name="trending-up-outline" size={11} color={ACCENT} />
            <Text style={fs.flipText}>
              Flip: +${deal.resaleIntel!.profitPotential} · {deal.resaleIntel!.roiPercent}% ROI · {deal.resaleIntel!.demandLevel} demand
            </Text>
          </View>
        )}

        <View style={fs.priceRow}>
          <View>
            <View style={fs.priceInner}>
              <Text style={[fs.price, { color: isExpired ? "#555" : darkMode ? "#fff" : "#111" }]}>
                {deal.price != null ? `$${Number(deal.price).toFixed(2)}` : "See deal"}
              </Text>
              {(deal.discountPercent ?? 0) > 0 && !isExpired && (
                <View style={fs.discountBadge}>
                  <Text style={fs.discountText}>-{deal.discountPercent}%</Text>
                </View>
              )}
            </View>
            {deal.originalPrice != null && deal.price != null && deal.originalPrice > deal.price && !isExpired && (
              <Text style={fs.originalPrice}>
                EST. VALUE: <Text style={fs.strikethrough}>${Number(deal.originalPrice).toFixed(2)}</Text>
              </Text>
            )}
          </View>

          <View style={{ gap: 6, alignItems: "flex-end" }}>
            {isExpired ? (
              <View style={fs.expiredBtn}>
                <Ionicons name="time-outline" size={13} color="#666" />
                <Text style={fs.expiredBtnText}>DEAL EXPIRED</Text>
              </View>
            ) : (
              <>
                {couponCode && !blurred && (
                  <TouchableOpacity style={fs.codeBtn} onPress={handleCopyCode}>
                    <Ionicons name={copied ? "checkmark" : "pricetag-outline"} size={12} color={copied ? "#22c55e" : "#000"} />
                    <Text style={fs.codeBtnText}>{copied ? "Copied!" : "Get Code"}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[fs.grabBtn, blurred && fs.grabBtnLocked]}
                  onPress={handleOpenDeal}
                >
                  {blurred
                    ? <><Ionicons name="lock-closed-outline" size={13} color="#888" /><Text style={[fs.grabText, { color: "#888" }]}>PREMIUM</Text></>
                    : <><Text style={fs.grabText}>GRAB DEAL</Text><Ionicons name="arrow-forward" size={13} color="#000" /></>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ─── Compact Styles ─────────────────────────────────────────── */

const cs = StyleSheet.create({
  card: {
    borderRadius: 10, overflow: "hidden", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)", flex: 1, margin: 4,
  },
  rareCard: { borderColor: "rgba(168,85,247,0.4)" },
  expiredCard: { borderColor: "rgba(255,255,255,0.03)", opacity: 0.7 },
  discountTag: {
    position: "absolute", top: 6, left: 6, zIndex: 10,
    backgroundColor: "#ca8a04", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3,
  },
  discountTagText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  imageWrap: {
    width: "100%", aspectRatio: 1, backgroundColor: "#fff",
    position: "relative", justifyContent: "center", alignItems: "center",
  },
  image: { width: "100%", height: "100%" },
  blurred: { opacity: 0.1 },
  imageFallback: {
    width: "100%", height: "100%", justifyContent: "center",
    alignItems: "center", backgroundColor: "#f4f4f5",
  },
  saveBtn: {
    position: "absolute", top: 5, right: 5,
    backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 999, padding: 5,
  },
  badgeRow: {
    position: "absolute", bottom: 4, left: 4,
    flexDirection: "row", gap: 3, flexWrap: "wrap",
  },
  badge: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  badgeTxt: { color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.3 },
  content: { padding: 8 },
  store: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8, marginBottom: 3 },
  title: { fontSize: 11, fontWeight: "700", lineHeight: 15, marginBottom: 5, minHeight: 30 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  price: { fontSize: 16, fontWeight: "900", color: ACCENT },
  original: { fontSize: 9, color: "#666", textDecorationLine: "line-through" },
  expiredBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 7, borderRadius: 6, backgroundColor: "#1a1a1a",
  },
  expiredBtnText: { color: "#666", fontWeight: "900", fontSize: 10 },
  codeBtn: {
    backgroundColor: "#06b6d4", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4, paddingVertical: 7, borderRadius: 6,
  },
  codeBtnText: { color: "#000", fontWeight: "900", fontSize: 10 },
  grabBtn: {
    backgroundColor: ACCENT, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4, paddingVertical: 7, borderRadius: 6,
  },
  grabBtnLocked: { backgroundColor: "#222" },
  grabText: { color: "#000", fontWeight: "900", fontSize: 10 },
});

/* ─── Full / List Styles ─────────────────────────────────────── */

const fs = StyleSheet.create({
  card: {
    borderRadius: 12, overflow: "hidden", marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  rareCard: { borderColor: "rgba(168,85,247,0.4)" },
  expiredCard: { borderColor: "rgba(255,255,255,0.03)", opacity: 0.7 },
  imageWrap: {
    width: "100%", aspectRatio: 1.4, backgroundColor: "#fff",
    position: "relative", justifyContent: "center", alignItems: "center",
  },
  image: { width: "100%", height: "100%" },
  blurred: { opacity: 0.1 },
  imageFallback: {
    flex: 1, justifyContent: "center", alignItems: "center",
    backgroundColor: "#f4f4f5", width: "100%",
  },
  imageFallbackText: { fontSize: 9, fontWeight: "800", color: "#999", textTransform: "uppercase", marginTop: 4 },
  badgeStack: { position: "absolute", top: 8, right: 8, gap: 4, alignItems: "flex-end" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 3 },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  saveBtn: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 999, padding: 7,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  content: { padding: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  storeBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4,
  },
  storeText: { fontSize: 8, fontWeight: "900", color: "#d4d4d8", letterSpacing: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  scoreText: { fontSize: 11, fontWeight: "900" },
  title: {
    fontSize: 12, fontWeight: "700", letterSpacing: 0.3,
    lineHeight: 17, marginBottom: 8, minHeight: 34,
  },
  flipStrip: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    backgroundColor: "rgba(255,255,255,0.05)", padding: 7, borderRadius: 6,
    borderLeftWidth: 2, borderLeftColor: ACCENT, marginBottom: 8,
  },
  flipText: { fontSize: 9, color: "#a1a1aa", fontWeight: "600", flex: 1, lineHeight: 13 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 },
  priceInner: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  price: { fontSize: 22, fontWeight: "900" },
  discountBadge: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  discountText: { fontSize: 9, fontWeight: "900", color: "#22c55e" },
  originalPrice: { fontSize: 9, color: "#71717a", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  strikethrough: { textDecorationLine: "line-through" },
  expiredBtn: {
    flexDirection: "row", alignItems: "center",
    gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "#1a1a1a",
  },
  expiredBtnText: { color: "#666", fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
  codeBtn: {
    backgroundColor: "#06b6d4", flexDirection: "row", alignItems: "center",
    gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7,
  },
  codeBtnText: { color: "#000", fontWeight: "900", fontSize: 10 },
  grabBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8,
  },
  grabBtnLocked: { backgroundColor: "#1a1a1a" },
  grabText: { color: "#000", fontWeight: "900", fontSize: 10, letterSpacing: 0.5 },
});