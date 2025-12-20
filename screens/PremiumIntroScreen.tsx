// flashradar/screens/PremiumIntroScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import SafeAreaWrapper from "../components/SafeAreaWrapper";

// ✅ Ensure "PremiumIntro" exists in RootStackParamList
type NavigationProp = NativeStackNavigationProp<RootStackParamList, "PremiumIntro">;

export default function PremiumIntroScreen() {
  const navigation = useNavigation<NavigationProp>();

  const features = [
    "Access to 15+ major stores",
    "Web Radar (online deal scanning)",
    "Rare Finds (exclusive deals)",
    "Unlimited results & filters",
    "Inventory tracking",
    "Coupon auto-apply",
    "Ad-free experience",
  ];

  // ✅ Action when user taps "Upgrade Now"
  const handleUpgrade = () => {
    navigation.navigate("MainTabs", { screen: "Settings" });
  };

  return (
    <SafeAreaWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>✨ Upgrade to Premium</Text>
        <Text style={styles.subheader}>Unlock the full power of FlashRadar</Text>

        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Text style={styles.check}>✔</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}

        {/* ✅ Button now navigates to Settings */}
        <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
          <Text style={styles.buttonText}>Upgrade Now</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Maybe Later</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  subheader: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    width: "90%",
  },
  check: {
    fontSize: 20,
    color: "#FF6600",
    marginRight: 10,
  },
  featureText: {
    fontSize: 16,
    color: "#333",
  },
  button: {
    backgroundColor: "#FF6600",
    padding: 15,
    borderRadius: 10,
    marginTop: 30,
    width: "90%",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  secondaryButton: {
    marginTop: 15,
  },
  secondaryButtonText: {
    color: "#666",
    fontSize: 14,
  },
});
