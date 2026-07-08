import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { FlipItem, getFlipExplanation } from "../utils";
import { useTheme } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import { functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";
let Clipboard: typeof import("expo-clipboard") | null = null;
try { Clipboard = require("expo-clipboard"); } catch { Clipboard = null; }

/* ─────────────────────────────
   CONSTANTS
───────────────────────────── */

const AMAZON_TAG = "flashradar20e-20";

/* ─────────────────────────────
   TYPES
───────────────────────────── */

type Props = {
  flip?: FlipItem;
};

/* ─────────────────────────────
   NORMALIZERS (STRING-SAFE)
───────────────────────────── */

function normalizeVerdict(v: any): "BUY" | "WAIT" | "SKIP" {
  if (v === "BUY" || v === "WAIT" || v === "SKIP") return v;
  return "SKIP";
}

function normalizeDealOrigin(
  o: any
): "PRICING_ERROR" | "SLOW_SELLER" | "OVERSTOCK" | "OBSOLETE" {
  if (
    o === "PRICING_ERROR" ||
    o === "SLOW_SELLER" ||
    o === "OVERSTOCK" ||
    o === "OBSOLETE"
  ) {
    return o;
  }
  return "OVERSTOCK";
}

function normalizeConfidence(value?: number): "LOW" | "MEDIUM" | "HIGH" {
  if (typeof value !== "number") return "LOW";
  if (value >= 80) return "HIGH";
  if (value >= 55) return "MEDIUM";
  return "LOW";
}

/* ─────────────────────────────
   HELPERS
───────────────────────────── */

function computeFlipScore(flip: FlipItem): number {
  let score = 50;

  const confidence =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  score += confidence * 0.4;

  if (flip.netProfit > 0) score += Math.min(flip.netProfit / 5, 20);
  else score -= 20;

  if (
    ["OVERSTOCK", "SLOW_SELLER", "OBSOLETE"].includes(
      normalizeDealOrigin(flip.dealOrigin)
    )
  ) {
    score -= 15;
  }

  if (flip.priceTrendingDown) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getRiskReasons(flip: FlipItem): string[] {
  const reasons: string[] = [];
  const confidence =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  if (confidence < 50)
    reasons.push("Low confidence based on limited resale data");

  if (
    ["OVERSTOCK", "SLOW_SELLER", "OBSOLETE"].includes(
      normalizeDealOrigin(flip.dealOrigin)
    )
  ) {
    reasons.push("Clearance or slow-moving inventory");
  }

  if (flip.priceTrendingDown)
    reasons.push("Market prices trending downward");

  return reasons;
}

function confidenceBadge(value?: number) {
  if (typeof value !== "number")
    return { label: "Unknown", color: "#888", pct: 0 };

  if (value >= 80)
    return { label: "High Confidence", color: "#4caf50", pct: value };
  if (value >= 55)
    return { label: "Medium Confidence", color: "#ff9800", pct: value };
  return { label: "Low Confidence", color: "#f44336", pct: value };
}

/* ─────────────────────────────
   SCREEN
───────────────────────────── */

export default function FlipItResultScreen(props: any) {
  const flip = props?.flip ?? props?.route?.params?.flip;
  const { colors } = useTheme();
  if (!flip) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "#fff" }}>No flip data available.</Text>
      </View>
    );
  }

  const flipScore = useMemo(() => computeFlipScore(flip), [flip]);
  const navigation = useNavigation<any>();
  const { isPremium } = useUser();
  const [platform, setPlatform] = useState("Facebook Marketplace");
  const [listing, setListing] = useState<any>(null);
  const [listingLoading, setListingLoading] = useState(false);

  const genListing = async () => {
    if (!isPremium) { navigation.navigate("Upgrade"); return; }
    if (listingLoading) return;
    setListingLoading(true);
    try {
      const call = httpsCallable(functions, "generateListing");
      const res: any = await call({
        title: flip.title,
        buyPrice: flip.buyPrice,
        avgResalePrice: flip.avgResalePrice,
        condition: "Used - Good",
        platform,
      });
      setListing(res.data?.draft ?? null);
    } catch (e) {
      Alert.alert("Couldn't generate listing", "Please try again.");
    } finally {
      setListingLoading(false);
    }
  };

  const copyListing = async () => {
    if (!listing) return;
    const text = `${listing.title}

${listing.description}

Asking: ${listing.suggestedPrice}`;
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(text);
      Alert.alert("Copied!", "Listing copied — paste it into " + platform + ".");
    }
  };
  const riskReasons = useMemo(() => getRiskReasons(flip), [flip]);

  const confidenceNumber =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  const confidenceUI = confidenceBadge(confidenceNumber);

  const explanation = getFlipExplanation({
    verdict: normalizeVerdict(flip.verdict) as any,
    confidence: normalizeConfidence(confidenceNumber) as any,
    dealOrigin: normalizeDealOrigin(flip.dealOrigin) as any,
    priceTrendingDown: flip.priceTrendingDown,
  });

  const openAmazonSearch = () => {
    const q = encodeURIComponent(flip.title || "product");
    Linking.openURL(
      `https://www.amazon.com/s?k=${q}&tag=${AMAZON_TAG}`
    );
  };

  const shareFlip = async () => {
    await Share.share({
      message: `
Flip Result 🔥

Verdict: ${flip.verdict}
Flip Score: ${flipScore}/100
Confidence: ${confidenceNumber}%
Net Profit: $${flip.netProfit}

Best Platform: ${flip.bestPlatform}
      `.trim(),
    });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.verdictCard, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent + "55" }]}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Flip Score</Text>
          <Text style={styles.scoreValue}>{flipScore}/100</Text>
        </View>

        <View
          style={[
            styles.confidenceBadge,
            { borderColor: confidenceUI.color },
          ]}
        >
          <Text
            style={[
              styles.confidenceText,
              { color: confidenceUI.color },
            ]}
          >
            {confidenceUI.label} • {confidenceNumber}%
          </Text>
        </View>

        <View style={styles.confidenceBarBg}>
          <View
            style={[
              styles.confidenceBarFill,
              {
                width: `${confidenceUI.pct}%`,
                backgroundColor: confidenceUI.color,
              },
            ]}
          />
        </View>

        <Text style={styles.verdict}>{flip.verdict}</Text>
        <Text style={styles.headline}>{explanation.headline}</Text>
        <Text style={styles.detail}>{explanation.detail}</Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={openAmazonSearch}
        >
          <Ionicons name="cart-outline" size={18} color="#fff" />
          <Text style={styles.primaryText}>Check Prices</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={shareFlip}>
          <Text style={styles.shareText}>📤 Share Flip</Text>
        </TouchableOpacity>
      </View>

      {riskReasons.length > 0 && (
        <View style={styles.riskBox}>
          <Text style={styles.riskTitle}>⚠️ Why this is risky</Text>
          {riskReasons.map((r, i) => (
            <Text key={i} style={styles.riskItem}>
              • {r}
            </Text>
          ))}
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accent + "4D" }]}>
        <Text style={styles.sectionTitle}>Profit Summary</Text>
        <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>Buy Price: ${flip.buyPrice}</Text>
        <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>Avg Resale: ${flip.avgResalePrice}</Text>
        <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>Net Profit: ${flip.netProfit}</Text>
        <Text style={{ color: colors.text, fontSize: 14, marginTop: 2 }}>Break Even: ${flip.breakEvenPrice}</Text>
      </View>

      {(flip as any).resaleEstimate && (
        <View style={est.box}>
          <Text style={est.head}>
            AI-estimated resale: ${(flip as any).resaleEstimate.low}–${(flip as any).resaleEstimate.high}
          </Text>
          <Text style={est.rationale}>{(flip as any).resaleEstimate.rationale}</Text>
          <Text style={est.warn}>
            ⚠️ Estimate only ({(flip as any).resaleEstimate.confidence} confidence). Verify with real sold listings before buying.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(
              "https://www.ebay.com/sch/i.html?_nkw=" + encodeURIComponent(flip.title || "") + "&LH_Sold=1&LH_Complete=1"
            )}
          >
            <Text style={est.link}>Check eBay sold listings →</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.accent + "4D" }]}>
        <Text style={styles.sectionTitle}>Best Platform</Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{flip.bestPlatform}</Text>
      </View>

      {/* ── SELL IT: AI Listing Generator ── */}
      <View style={sell.card}>
        <Text style={sell.head}>Sell It Fast</Text>
        <Text style={sell.sub}>AI writes your marketplace listing</Text>

        <View style={sell.platRow}>
          {["Facebook Marketplace", "OfferUp", "Mercari"].map((pl) => (
            <TouchableOpacity key={pl} onPress={() => setPlatform(pl)}
              style={[sell.platChip, platform === pl && sell.platChipActive]}>
              <Text style={[sell.platText, platform === pl && sell.platTextActive]}>
                {pl.replace(" Marketplace", "")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={sell.genBtn} onPress={genListing} disabled={listingLoading}>
          {listingLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={sell.genText}>{isPremium ? "Generate Listing" : "🔒 Generate Listing (Premium)"}</Text>
          )}
        </TouchableOpacity>

        {listing && (
          <View style={sell.draft}>
            <Text style={sell.draftTitle}>{listing.title}</Text>
            <Text style={sell.draftDesc}>{listing.description}</Text>
            <Text style={sell.draftPrice}>Asking: ${listing.suggestedPrice}</Text>
            {Array.isArray(listing.tips) && listing.tips.map((t: string, i: number) => (
              <Text key={i} style={sell.tip}>• {t}</Text>
            ))}
            <TouchableOpacity style={sell.copyBtn} onPress={copyListing}>
              <Ionicons name="copy-outline" size={15} color="#000" />
              <Text style={sell.copyText}>Copy Listing</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

/* ───────────────────────────── */

const est = StyleSheet.create({
  box: { backgroundColor: "#1a1400", borderRadius: 12, padding: 14, margin: 12, borderWidth: 1, borderColor: "rgba(255,180,0,0.35)" },
  head: { color: "#FFB400", fontSize: 15, fontWeight: "900" },
  rationale: { color: "#ccc", fontSize: 12, marginTop: 6, lineHeight: 17 },
  warn: { color: "#FFB400", fontSize: 12, fontWeight: "700", marginTop: 8 },
  link: { color: "#4da3ff", fontSize: 13, fontWeight: "800", marginTop: 10 },
});

const sell = StyleSheet.create({
  card: { backgroundColor: "#141414", borderRadius: 14, padding: 16, margin: 12, borderWidth: 1, borderColor: "rgba(255,122,0,0.3)" },
  head: { color: "#fff", fontSize: 17, fontWeight: "900" },
  sub: { color: "#888", fontSize: 12, marginTop: 2, marginBottom: 12 },
  platRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  platChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#242424" },
  platChipActive: { backgroundColor: "#FF7A00" },
  platText: { color: "#aaa", fontSize: 12, fontWeight: "700" },
  platTextActive: { color: "#000" },
  genBtn: { backgroundColor: "#FF7A00", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  genText: { color: "#000", fontWeight: "900", fontSize: 14 },
  draft: { marginTop: 14, backgroundColor: "#0f0f0f", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#2a2a2a" },
  draftTitle: { color: "#fff", fontSize: 15, fontWeight: "800", marginBottom: 8 },
  draftDesc: { color: "#ccc", fontSize: 13, lineHeight: 19, marginBottom: 8 },
  draftPrice: { color: "#FF7A00", fontSize: 15, fontWeight: "900", marginBottom: 10 },
  tip: { color: "#999", fontSize: 12, lineHeight: 18 },
  copyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fff", borderRadius: 10, paddingVertical: 11, marginTop: 12 },
  copyText: { color: "#000", fontWeight: "800", fontSize: 13 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0e0e", padding: 16, paddingTop: 64 },
  verdictCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scoreLabel: { fontSize: 14, color: "#bbb", fontWeight: "600" },
  scoreValue: { fontSize: 18, fontWeight: "800", color: "#ff7a00" },
  verdict: {
    fontSize: 30,
    fontWeight: "800",
    color: "#ff7a00",
    marginTop: 6,
  },
  confidenceBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  confidenceText: { fontSize: 13, fontWeight: "700" },
  confidenceBarBg: {
    height: 6,
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 6,
    marginBottom: 10,
  },
  confidenceBarFill: { height: 6, borderRadius: 6 },
  headline: { fontSize: 18, fontWeight: "600", color: "#fff" },
  detail: { fontSize: 14, color: "#aaa", marginTop: 4 },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#ff7a00",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  shareBtn: {
    marginTop: 10,
    backgroundColor: "#333",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  shareText: { color: "#fff", fontWeight: "700" },
  riskBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#333",
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffb020",
    marginBottom: 6,
  },
  riskItem: { fontSize: 13, color: "#ccc" },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
});
