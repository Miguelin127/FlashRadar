// flashradar/screens/FlipItResultScreen.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { FlipItem } from "../utils/FlipItem";
import { getFlipExplanation } from "../utils/flipExplanation";

/* ─────────────────────────────
   CONSTANTS
───────────────────────────── */

const CLEARANCE_ORIGINS: FlipItem["dealOrigin"][] = [
  "OVERSTOCK",
  "SLOW_SELLER",
  "OBSOLETE",
];

/* ─────────────────────────────
   HELPERS (SAFE)
───────────────────────────── */

// 🔢 Flip Score (0–100)
function computeFlipScore(flip: FlipItem): number {
  let score = 50;

  const confidence =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  score += confidence * 0.4;

  if (flip.netProfit > 0) score += Math.min(flip.netProfit / 5, 20);
  else score -= 20;

  if (CLEARANCE_ORIGINS.includes(flip.dealOrigin)) score -= 15;
  if (flip.priceTrendingDown) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ⚠️ Risk reasons (UI only)
function getRiskReasons(flip: FlipItem): string[] {
  const reasons: string[] = [];

  const confidence =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  if (confidence < 50) {
    reasons.push("Low confidence based on limited resale data");
  }

  if (CLEARANCE_ORIGINS.includes(flip.dealOrigin)) {
    reasons.push(
      "Clearance or slow-moving inventory often has lower resale demand"
    );
  }

  if (flip.priceTrendingDown) {
    reasons.push("Market prices are trending downward");
  }

  return reasons;
}

// 🧠 NUMBER → ConfidenceLevel (engine-safe)
function numberToConfidenceLevel(
  value?: number
): "LOW" | "MEDIUM" | "HIGH" {
  if (typeof value !== "number") return "LOW";
  if (value >= 80) return "HIGH";
  if (value >= 55) return "MEDIUM";
  return "LOW";
}

// 🎨 Confidence badge (UI only)
function confidenceBadge(value?: number) {
  if (typeof value !== "number")
    return { label: "Unknown", color: "#888", pct: 0 };

  if (value >= 80)
    return { label: "High Confidence", color: "#4caf50", pct: value };
  if (value >= 55)
    return { label: "Medium Confidence", color: "#ff9800", pct: value };
  return { label: "Low Confidence", color: "#f44336", pct: value };
}

/* ───────────────────────────── */

interface Props {
  flip: FlipItem;
}

export default function FlipItResultScreen({ flip }: Props) {
  const flipScore = useMemo(() => computeFlipScore(flip), [flip]);
  const riskReasons = useMemo(() => getRiskReasons(flip), [flip]);

  const confidenceNumber =
    typeof flip.confidence === "number" ? flip.confidence : 0;

  const confidenceUI = confidenceBadge(confidenceNumber);
  const confidenceLevel = numberToConfidenceLevel(confidenceNumber);

  // ✅ Engine call — DO NOT TOUCH
  const explanation = getFlipExplanation({
    verdict: flip.verdict,
    confidence: confidenceLevel,
    dealOrigin: flip.dealOrigin,
    priceTrendingDown: flip.priceTrendingDown,
  });

  const shareFlip = async () => {
    await Share.share({
      message: `
Flip Result 🔥

Verdict: ${flip.verdict}
Flip Score: ${flipScore}/100
Confidence: ${confidenceNumber}%
Net Profit: $${flip.netProfit}

Best Platform: ${flip.bestPlatform}

${riskReasons.length ? "⚠️ Risks:\n- " + riskReasons.join("\n- ") : ""}
      `.trim(),
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Verdict Card */}
      <View style={styles.verdictCard}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Flip Score</Text>
          <Text style={styles.scoreValue}>{flipScore}/100</Text>
        </View>

        {/* Confidence Badge */}
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

        {/* Confidence Meter (NEW – UI ONLY) */}
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

        <TouchableOpacity style={styles.shareBtn} onPress={shareFlip}>
          <Text style={styles.shareText}>📤 Share Flip</Text>
        </TouchableOpacity>
      </View>

      {/* Risk Reasons */}
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

      {/* Profit Summary */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profit Summary</Text>
        <Text>Buy Price: ${flip.buyPrice}</Text>
        <Text>Avg Resale: ${flip.avgResalePrice}</Text>
        <Text>Net Profit: ${flip.netProfit}</Text>
        <Text>Break Even: ${flip.breakEvenPrice}</Text>
      </View>

      {/* Best Platform */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Best Platform</Text>
        <Text>{flip.bestPlatform}</Text>
      </View>

      {/* 
        🔒 FUTURE EXTENSIONS (NOT IMPLEMENTED HERE):
        - Persist flip history (Firestore / AsyncStorage)
        - Jest tests for computeFlipScore
      */}
    </ScrollView>
  );
}

/* ───────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0e0e", padding: 16 },
  verdictCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#1a1a1a",
    marginBottom: 16,
  },
  scoreRow: { flexDirection: "row", justifyContent: "space-between" },
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
  confidenceBarFill: {
    height: 6,
    borderRadius: 6,
  },
  headline: { fontSize: 18, fontWeight: "600", color: "#fff" },
  detail: { fontSize: 14, color: "#aaa", marginTop: 4 },
  shareBtn: {
    marginTop: 12,
    backgroundColor: "#FF6600",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  shareText: { color: "#fff", fontWeight: "800", fontSize: 14 },
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
