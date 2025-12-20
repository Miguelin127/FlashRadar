// flashradar/screens/UpgradeScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";

export default function UpgradeScreen() {
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);

  // ✅ Start real Stripe checkout
  const handleUpgrade = async () => {
    if (!user) {
      Alert.alert("Login Required", "Please log in first.");
      return;
    }

    setLoading(true);
    try {
      console.log("⚡ Starting checkout for UID:", user.uid);

      const response = await fetch(
        "https://us-central1-flashradar-71c93.cloudfunctions.net/createCheckoutSession",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid: user.uid, plan: "monthly" }),
        }
      );

      const data = await response.json();
      if (data?.url) {
        console.log("✅ Opening Stripe checkout:", data.url);
        await Linking.openURL(data.url);
        // 👇 After checkout, Stripe will redirect to `flashradar://settings?status=success`
        // which will trigger navigation inside App.tsx
      } else {
        console.error("❌ Invalid checkout response:", data);
        Alert.alert("Error", "Failed to create checkout session.");
      }
    } catch (error: any) {
      console.error("🚨 Checkout error:", error);
      Alert.alert("Error", error.message || "Could not start checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleMaybeLater = () => {
    navigation.navigate("MainTabs", { screen: "Settings" });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✨ Upgrade to Premium</Text>
      <Text style={styles.subtitle}>Unlock the full power of FlashRadar</Text>

      {[
        "Access to 15+ major stores",
        "Web Radar (online deal scanning)",
        "Rare Finds (exclusive deals)",
        "Unlimited results & filters",
        "Inventory tracking",
        "Coupon auto-apply",
        "Ad-free experience",
      ].map((text, i) => (
        <View key={i} style={styles.row}>
          <Ionicons name="checkmark-circle" size={20} color="#FF6600" />
          <Text style={styles.benefit}>{text}</Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.button}
        onPress={handleUpgrade}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upgrade Now</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleMaybeLater}>
        <Text style={styles.maybeLater}>Maybe Later</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────── STYLES ───────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  benefit: {
    marginLeft: 8,
    fontSize: 15,
    color: "#333",
  },
  button: {
    backgroundColor: "#FF6600",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  maybeLater: {
    textAlign: "center",
    color: "#888",
    marginTop: 12,
  },
});
