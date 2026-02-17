// FlashRadarProject/components/DealRiskBadge.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

interface Props {
  riskLevel: RiskLevel;
  label: string;
}

export default function DealRiskBadge({ riskLevel, label }: Props) {
  const config = {
    LOW: {
      bg: "#1e3a2f",
      text: "#4ade80",
      icon: "🔥",
    },
    MEDIUM: {
      bg: "#3a2f1e",
      text: "#facc15",
      icon: "⚠️",
    },
    HIGH: {
      bg: "#3a1e1e",
      text: "#f87171",
      icon: "❌",
    },
  }[riskLevel];

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>
        {config.icon} {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 8,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
