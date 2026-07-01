// flashradar/screens/UpgradeScreen.tsx

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { initializePurchases, getProducts, purchaseSubscription, restorePurchases } from "../utils/purchases";

const { width: SW } = Dimensions.get("window");
const ACCENT = "#FF7A00";

/* ─── Types ──────────────────────────────────────────────────── */

type IoniconName = keyof typeof Ionicons.glyphMap;

type PremiumFeature = {
  icon: IoniconName;
  label: string;
  sub: string;
  color: string;
};

type FreeFeature = {
  label: string;
  included: boolean;
};

/* ─── Data ───────────────────────────────────────────────────── */

const FREE_FEATURES: FreeFeature[] = [
  { label: "Walmart deals", included: true },
  { label: "Target deals", included: true },
  { label: "Home Depot deals", included: true },
  { label: "Basic deal feed", included: true },
  { label: "Save favorites", included: true },
  { label: "Amazon deals", included: false },
  { label: "Best Buy & Costco", included: false },
  { label: "Sam's Club & Lowe's", included: false },
  { label: "Rare Finds network", included: false },
  { label: "Flip It mode", included: false },
  { label: "Priority alerts", included: false },
  { label: "Advanced filters", included: false },
];

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: "storefront-outline",
    label: "All stores unlocked",
    sub: "Amazon, Best Buy, Costco, Sam's Club, Lowe's + more",
    color: ACCENT,
  },
  {
    icon: "diamond-outline",
    label: "Rare Finds network",
    sub: "Hidden clearance, limited inventory, collectibles",
    color: "#a855f7",
  },
  {
    icon: "trending-up-outline",
    label: "Flip It mode",
    sub: "Resale profit estimates, eBay comparisons, ROI scoring",
    color: "#22c55e",
  },
  {
    icon: "flash-outline",
    label: "Priority alerts",
    sub: "Get notified before free users — first mover advantage",
    color: "#eab308",
  },
  {
    icon: "options-outline",
    label: "Advanced filters",
    sub: "Filter by ROI, rarity, radius, profit potential",
    color: "#3b82f6",
  },
  {
    icon: "map-outline",
    label: "Expanded radar radius",
    sub: "Search deals beyond your local area",
    color: "#ec4899",
  },
  {
    icon: "bar-chart-outline",
    label: "Creator dashboard",
    sub: "Referral tracking, earnings, campaign analytics",
    color: ACCENT,
  },
];

/* ─── Sub-components ─────────────────────────────────────────── */

function CompareRow({ label, included }: FreeFeature) {
  const { colors } = useTheme();
  return (
    <View style={cr.row}>
      <Ionicons
        name={included ? "checkmark-circle" : "close-circle-outline"}
        size={18}
        color={included ? "#22c55e" : "#444"}
      />
      <Text style={[cr.label, { color: included ? colors.text : colors.subtext }]}>
        {label}
      </Text>
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  label: { fontSize: 13, fontWeight: "600" },
});

function FeatureCard({ icon, label, sub, color }: PremiumFeature) {
  const { colors } = useTheme();
  return (
    <View style={[fc.card, { backgroundColor: colors.card, borderColor: color + "33" }]}>
      <View style={[fc.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={fc.text}>
        <Text style={[fc.label, { color: colors.text }]}>{label}</Text>
        <Text style={[fc.sub, { color: colors.subtext }]}>{sub}</Text>
      </View>
    </View>
  );
}

const fc = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111", borderRadius: 12,
    padding: 12, marginBottom: 8, borderWidth: 1,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  text: { flex: 1 },
  label: { color: "#fff", fontSize: 13, fontWeight: "800" },
  sub: { color: "#888", fontSize: 11, marginTop: 2, lineHeight: 15 },
});

/* ─── Main Screen ────────────────────────────────────────────── */

export default function UpgradeScreen() {
  const { colors } = useTheme();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation();

  const savings = Math.round(100 - (69.99 / (6.99 * 12)) * 100);

  const handleUpgrade = async () => {
    if (!user?.uid) {
      Alert.alert("Sign in required", "Please sign in to upgrade.");
      return;
    }
    try {
      setLoading(true);
      await initializePurchases();
      const productId = plan === "monthly"
        ? "com.miguelin1.flashradarapp.premium.monthly"
        : "com.miguelin1.flashradarapp.premium.yearly";
      const success = await purchaseSubscription(productId);
      if (success) {
        Alert.alert("Welcome to Premium!", "You now have full access to FlashRadar.");
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert("Purchase failed", e.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await initializePurchases();
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert("Restored!", "Your premium subscription has been restored.");
        navigation.goBack();
      } else {
        Alert.alert("Nothing to restore", "No previous purchases found.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Close ── */}
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={colors.subtext} />
        </TouchableOpacity>

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flash" size={28} color={ACCENT} />
          </View>
          <Text style={styles.heroTag}>FLASHRADAR PREMIUM</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Get the{"\n"}full radar.</Text>
          <Text style={[styles.heroSub, { color: colors.subtext }]}>
            Unlock every store, every rare find, and every flip opportunity.
          </Text>
        </View>

        {/* ── Plan toggle ── */}
        <View style={styles.planToggle}>
          <TouchableOpacity
            onPress={() => setPlan("monthly")}
            style={[styles.planBtn, { backgroundColor: colors.card }, plan === "monthly" && styles.planBtnActive]}
          >
            <Text style={[styles.planBtnLabel, { color: colors.subtext }, plan === "monthly" && { color: "#000" }]}>
              Monthly
            </Text>
            <Text style={[styles.planBtnPrice, { color: colors.text }, plan === "monthly" && { color: "#000" }]}>
              $6.99/mo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPlan("yearly")}
            style={[styles.planBtn, { backgroundColor: colors.card }, plan === "yearly" && styles.planBtnActive]}
          >
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsBadgeText}>SAVE {savings}%</Text>
            </View>
            <Text style={[styles.planBtnLabel, { color: colors.subtext }, plan === "yearly" && { color: "#000" }]}>
              Yearly
            </Text>
            <Text style={[styles.planBtnPrice, { color: colors.text }, plan === "yearly" && { color: "#000" }]}>
              $69.99/yr
            </Text>
            <Text style={[styles.planBtnSub, plan === "yearly" && { color: "#00000088" }]}>
              $5.83/mo
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── CTA ── */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
          onPress={handleUpgrade}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={styles.ctaBtnText}>
                Unlock Premium — {plan === "monthly" ? "$6.99/mo" : "$69.99/yr"}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.ctaSub}>Cancel anytime · Billed through Apple</Text>
        <TouchableOpacity onPress={handleRestore} style={{ marginTop: 4 }}>
          <Text style={{ color: colors.subtext, fontSize: 12, textAlign: "center", textDecorationLine: "underline" }}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* ── Features ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What you unlock</Text>
        {PREMIUM_FEATURES.map((f) => (
          <FeatureCard key={f.label} {...f} />
        ))}

        {/* ── Free vs Premium ── */}
        <View style={[styles.compareWrap, { backgroundColor: colors.card }]}>
          <Text style={[styles.compareColTitle, { color: colors.subtext }]}>What's included in Free</Text>
          {FREE_FEATURES.map((f) => (
            <CompareRow key={f.label} {...f} />
          ))}
        </View>

        {/* ── Social proof ── */}
        <View style={[styles.proofWrap, { backgroundColor: colors.card }]}>
          <Text style={[styles.proofText, { color: colors.subtext }]}>
            "Found a $40 Pokémon card lot at Target clearance.{"\n"}
            Sold for $210 on eBay. FlashRadar paid for itself in one flip."
          </Text>
          <Text style={styles.proofAuthor}>— Early FlashRadar user</Text>
        </View>

        {/* ── Second CTA ── */}
        <TouchableOpacity
          style={[styles.ctaBtn, { marginTop: 8 }, loading && { opacity: 0.7 }]}
          onPress={handleUpgrade}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.ctaBtnText}>
              Get Premium — {plan === "monthly" ? "$6.99/month" : "$69.99/year"}
            </Text>
          )}
        </TouchableOpacity>
<Text style={[styles.legalText, { color: colors.subtext }]}>
          Subscription auto-renews. Cancel anytime in Settings → Manage Subscription.
          By subscribing you agree to our{" "}
          <Text
            style={{ textDecorationLine: "underline", color: "#ff6b00" }}
            onPress={() => Linking.openURL("https://flashradarapp.com/terms.html")}
          >
            Terms of Use (EULA)
          </Text>
          {" "}and{" "}
          <Text
            style={{ textDecorationLine: "underline", color: "#ff6b00" }}
            onPress={() => Linking.openURL("https://flashradarapp.com/privacy.html")}
          >
            Privacy Policy
          </Text>
          .
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 60 },

  closeBtn: { alignSelf: "flex-end", padding: 4, marginBottom: 8 },

  hero: { alignItems: "center", marginBottom: 28 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: ACCENT + "20",
    justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  heroTag: {
    fontSize: 11, fontWeight: "900", color: ACCENT,
    letterSpacing: 2, marginBottom: 8,
  },
  heroTitle: {
    fontSize: 38, fontWeight: "900", color: "#fff",
    textAlign: "center", lineHeight: 42, marginBottom: 10,
  },
  heroSub: {
    fontSize: 15, color: "#888", textAlign: "center", lineHeight: 22,
  },

  planToggle: { flexDirection: "row", gap: 10, marginBottom: 20 },
  planBtn: {
    flex: 1, borderRadius: 14, padding: 14,
    backgroundColor: "#111", borderWidth: 1, borderColor: "#222",
    alignItems: "center", position: "relative",
  },
  planBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  planBtnLabel: { color: "#888", fontSize: 12, fontWeight: "700", marginBottom: 4 },
  planBtnPrice: { color: "#fff", fontSize: 20, fontWeight: "900" },
  planBtnSub: { color: "#ffffff88", fontSize: 11, marginTop: 2 },
  savingsBadge: {
    position: "absolute", top: -10, right: -8,
    backgroundColor: "#22c55e",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  savingsBadgeText: { color: "#000", fontSize: 9, fontWeight: "900" },

  ctaBtn: {
    backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: ACCENT, shadowRadius: 20, shadowOpacity: 0.4, elevation: 8,
  },
  ctaBtnText: { color: "#000", fontWeight: "900", fontSize: 16 },
  ctaSub: {
    color: "#666", fontSize: 11, textAlign: "center",
    marginTop: 8, marginBottom: 20,
  },

  sectionTitle: {
    color: "#fff", fontSize: 18, fontWeight: "900",
    marginBottom: 12, marginTop: 8,
  },

  compareWrap: {
    backgroundColor: "#0f0f0f", borderRadius: 14,
    padding: 16, marginTop: 20, marginBottom: 20,
    borderWidth: 1, borderColor: "#1a1a1a",
  },
  compareColTitle: {
    color: "#888", fontSize: 12, fontWeight: "900",
    letterSpacing: 1, marginBottom: 10, textTransform: "uppercase",
  },

  proofWrap: {
    backgroundColor: "#111", borderRadius: 14, padding: 16,
    borderLeftWidth: 3, borderLeftColor: ACCENT, marginBottom: 20,
  },
  proofText: { color: "#aaa", fontSize: 13, lineHeight: 20, fontStyle: "italic" },
  proofAuthor: { color: ACCENT, fontSize: 11, fontWeight: "800", marginTop: 8 },

  legalText: {
    color: "#444", fontSize: 10, textAlign: "center",
    lineHeight: 15, marginTop: 16,
  },
});