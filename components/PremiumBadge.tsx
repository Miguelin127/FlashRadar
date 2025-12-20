import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function PremiumBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>⭐ Premium</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "#FFA500", // orange theme
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "bold",
    color: "#fff",
    fontSize: 14,
  },
});
