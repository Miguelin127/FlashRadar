// flashradar/screens/UpgradeScreen.tsx

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Dimensions, Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";
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
  { label: "walmartDeals", included: true },
  { label: "targetDeals", included: true },
  { label: "homeDepotDeals", included: true },
  { label: "basicDealFeed", included: true },
  { label: "saveFavorites", included: true },
  { label: "amazonDeals", included: false },
  { label: "bestBuyCostco", included: false },
  { label: "samsClubLowes", included: false },
  { label: "rareFinds", included: false },
  { label: "flipMode", included: false },
  { label: "priorityAlerts", included: false },
  { label: "advancedFilters", included: false },
];

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: "storefront-outline",
    label: "allStoresUnlocked",
    sub: "allStoresDesc",
    color: ACCENT,
  },
  {
    icon: "diamond-outline",
    label: "rareFinds",
    sub: "rareFindsDesc",
    color: "#a855f7",
  },
  {
    icon: "trending-up-outline",
    label: "flipMode",
    sub: "flipModeDesc",
    color: "#22c55e",
  },
  {
    icon: "flash-outline",
    label: "priorityAlerts",
    sub: "priorityAlertsDesc",
    color: "#eab308",
  },
  {
    icon: "options-outline",
    label: "advancedFilters",
    sub: "advancedFiltersDesc",
    color: "#3b82f6",
  },
  {
    icon: "map-outline",
    label: "expandedRadar",
    sub: "expandedRadarDesc",
    color: "#ec4899",
  },
  {
    icon: "bar-chart-outline",
    label: "creatorDash",
    sub: "creatorDashDesc",
    color: ACCENT,
  },
];

/* ─── Sub-components ─────────────────────────────────────────── */

function CompareRow({ label, included, t }: FreeFeature & { t: any }) {
  const { colors } = useTheme();
  return (
    <View style={cr.row}>
      <Ionicons
        name={included ? "checkmark-circle" : "close-circle-outline"}
        size={18}
        color={included ? "#22c55e" : "#444"}
      />
      <Text style={[cr.label, { color: included ? colors.text : colors.subtext }]}>
        {t.upgrade[label]}
      </Text>
    </View>
  );
}

const cr = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  label: { fontSize: 13, fontWeight: "600" },
});

function FeatureCard({ icon, label, sub, color, t }: PremiumFeature & { t: any }) {
  const { colors } = useTheme();
  return (
    <View style={[fc.card, { backgroundColor: colors.card, borderColor: color + "33" }]}>
      <View style={[fc.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={fc.text}>
        <Text style={[fc.label, { color: colors.text }]}>{t.upgrade[label]}</Text>
        <Text style={[fc.sub, { color: colors.subtext }]}>{t.upgrade[sub]}</Text>
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
  const { language } = useLanguage();
  const t = getStrings(language);
  const { colors } = useTheme();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation();

  const savings = Math.round(100 - (69.99 / (6.99 * 12)) * 100);

  const handleUpgrade = async () => {
    if (!user?.uid) {
      Alert.alert(t.upgrade.signInRequired, t.upgrade.pleaseSignIn);
      return;
    }
    try {
      setLoading(true);
      await initializePurchases();
      const isAndroid = Platform.OS === "android";
      const productId = plan === "monthly"
        ? (isAndroid ? "flashradarapp.premium.monthly" : "com.miguelin1.flashradarapp.premium.monthly")
        : (isAndroid ? "flashradarapp.premium.yearly" : "com.miguelin1.flashradarapp.premium.yearly");
      const success = await purchaseSubscription(productId);
      if (success) {
        Alert.alert(t.upgrade.welcomePremium, t.upgrade.premiumAccess);
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
        Alert.alert(t.upgrade.restored, t.upgrade.subscriptionRestored);
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
          <Text style={styles.heroTag}>{t.upgrade.premium}</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{t.upgrade.fullRadar}</Text>
          <Text style={[styles.heroSub, { color: colors.subtext }]}>
            {t.upgrade.unlockEvery}
          </Text>
        </View>

        {/* ── Plan toggle ── */}
        <View style={styles.planToggle}>
          <TouchableOpacity
            onPress={() => setPlan("monthly")}
            style={[styles.planBtn, { backgroundColor: colors.card }, plan === "monthly" && styles.planBtnActive]}
          >
            <Text style={[styles.planBtnLabel, { color: colors.subtext }, plan === "monthly" && { color: "#000" }]}>
              {t.upgrade.monthly}
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
              {t.upgrade.yearly}
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
                {t.upgrade.unlockPremium} — {plan === "monthly" ? "$6.99" + t.upgrade.perMonth : "$69.99" + t.upgrade.perYear}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.ctaSub}>{t.upgrade.cancelAnytime} {Platform.OS === "android" ? "Google Play" : "Apple"}</Text>
        <TouchableOpacity onPress={handleRestore} style={{ marginTop: 4 }}>
          <Text style={{ color: colors.subtext, fontSize: 12, textAlign: "center", textDecorationLine: "underline" }}>
            {t.upgrade.restorePurchases}
          </Text>
        </TouchableOpacity>

        {/* ── Features ── */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.upgrade.whatUnlock}</Text>
        {PREMIUM_FEATURES.map((f) => (
          <FeatureCard key={f.label} {...f} t={t} />
        ))}

        {/* ── Free vs Premium ── */}
        <View style={[styles.compareWrap, { backgroundColor: colors.card }]}>
          <Text style={[styles.compareColTitle, { color: colors.subtext }]}>{t.upgrade.freeIncluded}</Text>
          {FREE_FEATURES.map((f) => (
            <CompareRow key={f.label} {...f} t={t} />
          ))}
        </View>

        {/* ── Social proof ── */}
        <View style={[styles.proofWrap, { backgroundColor: colors.card }]}>
          <Text style={[styles.proofText, { color: colors.subtext }]}>
            "Found a $40 Pokémon card lot at Target clearance.{"\n"}
            Sold for $210 on eBay. FlashRadar paid for itself in one flip."
          </Text>
          <Text style={styles.proofAuthor}>{t.upgrade.socialProofAuthor}</Text>
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
              {t.upgrade.getPremiumBtn} — {plan === "monthly" ? "$6.99/month" : "$69.99/year"}
            </Text>
          )}
        </TouchableOpacity>
<Text style={[styles.legalText, { color: colors.subtext }]}>
          {t.upgrade.autoRenew}
          {" "}{t.upgrade.agreeTerms}{" "}
          <Text
            style={{ textDecorationLine: "underline", color: "#ff6b00" }}
            onPress={() => Linking.openURL("https://flashradarapp.com/terms.html")}
          >
            {t.upgrade.termsLink}
          </Text>
          {" "}{t.upgrade.and}{" "}
          <Text
            style={{ textDecorationLine: "underline", color: "#ff6b00" }}
            onPress={() => Linking.openURL("https://flashradarapp.com/privacy.html")}
          >
            {t.upgrade.privacyLink}
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