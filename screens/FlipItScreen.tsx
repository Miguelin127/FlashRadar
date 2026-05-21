// flashradar/screens/FlipItScreen.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../context/UserContext";
import { firebase, db } from "../firebaseConfig";

import type { RootStackParamList } from "../navigation/RootNavigator";

/* ───────── CONSTANTS ───────── */

const PARSE_ENDPOINT =
  "https://us-central1-flashradar-71c93.cloudfunctions.net/parseProduct";

export default function FlipItScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { isPremium } = useUser();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const scrollRef = useRef<ScrollView | null>(null);

  const isDark =
    (colors.background || "").toLowerCase() === "#000" ||
    (colors.background || "").toLowerCase() === "#000000";

  /* ───────── Theme ───────── */
  const cardBg = isDark ? "#141414" : "#ffffff";
  const cardBorder = isDark ? "#2a2a2a" : "#e6e6e6";
  const textPrimary = isDark ? "#ffffff" : "#111111";
  const textSecondary = isDark ? "#b5b5b5" : "#666666";
  const inputBg = isDark ? "#0f0f0f" : "#f2f2f2";
  const inputBorder = isDark ? "#333" : "#ddd";

  const [dealUrl, setDealUrl] = useState("");
  const [totalFlips, setTotalFlips] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  /* ───────── LIVE FLIP PERFORMANCE ───────── */
  useEffect(() => {
    if (!user) return;

    // ── Compat SDK — matches db instance from firebaseConfig.ts ─────────────
    // Previously used modular SDK (query/collection/onSnapshot from
    // "firebase/firestore") which silently fails with a compat db instance.
    const unsub = db
      .collection("users")
      .doc(user.uid)
      .collection("flips")
      .orderBy("timestamp", "desc")
      .onSnapshot((snap) => {
        let profit = 0;
        snap.forEach((d) => {
          const data = d.data();
          const buy = Number(data.buyPrice);
          const sell = Number(data.sellPrice);
          if (!Number.isFinite(buy) || !Number.isFinite(sell)) return;
          profit += sell - buy;
        });
        setTotalFlips(snap.size);
        setTotalProfit(profit);
      });

    return () => unsub();
  }, [user]);

  /* ───────── Helpers ───────── */
  const requirePremium = (action: () => void) => {
    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        "Flip It tools are available on Premium.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Go Premium",
            onPress: () => navigation.navigate("PremiumIntro"),
          },
        ]
      );
      return;
    }
    action();
  };

  /* ───────── EVALUATE DEAL ───────── */
  const evaluateDeal = async () => {
    if (!dealUrl.trim()) {
      Alert.alert("Missing link", "Paste a product link first.");
      return;
    }

    if (!dealUrl.startsWith("http")) {
      Alert.alert("Invalid link", "Please paste a valid product URL.");
      return;
    }

    try {
      const res = await fetch(PARSE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dealUrl }),
      });

      const data = await res.json();

      if (!res.ok || data?.error) {
        Alert.alert(
          "Limited data",
          "We couldn't auto-detect the price. Please enter it manually."
        );
        return;
      }

      const price = Number(String(data.price ?? "").replace(/[^0-9.]/g, ""));

      if (!Number.isFinite(price) || price <= 0) {
        Alert.alert(
          "Invalid price",
          "Detected price was invalid. Please enter manually."
        );
        return;
      }

      const title = String(data.title || "Product").slice(0, 200);

      // ── Compat SDK ─────────────────────────────────────────────────────────
      await db
        .collection("users")
        .doc(user!.uid)
        .collection("flips")
        .add({
          title,
          buyPrice: price,
          sellPrice: 0,
          profit: 0,
          source: "link",
          createdFrom: "flipit",
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        });

      Alert.alert(
        "Deal Evaluated",
        `${title}\n\nBuy Price: $${price.toFixed(2)}\n\nSaved to My Flips`
      );

      setDealUrl("");
    } catch (err) {
      console.error(err);
      Alert.alert("Evaluation failed", "Unable to evaluate this product.");
    }
  };

  // ── isPremium from context is boolean, never null — no loading gate needed
  if (isPremium === undefined) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.accent }]}>Flip It</Text>

        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/flipit_banner.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* ───── ACTION CARDS ───── */}
        <View style={styles.row}>
          <Pressable
            onPress={() => requirePremium(() => navigation.navigate("FlipScanner"))}
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                opacity: !isPremium ? 0.45 : 1,
              },
            ]}
          >
            <Ionicons name="barcode-outline" size={28} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: textPrimary }]}>
              Scan Barcode
            </Text>
            <Text style={[styles.cardSub, { color: textSecondary }]}>
              Check resale value
            </Text>
          </Pressable>

          <Pressable
            onPress={() => requirePremium(() => navigation.navigate("MyFlips"))}
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                opacity: !isPremium ? 0.45 : 1,
              },
            ]}
          >
            <Ionicons name="time-outline" size={28} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: textPrimary }]}>
              My Flips
            </Text>
            <Text style={[styles.cardSub, { color: textSecondary }]}>
              Live saved flips
            </Text>
          </Pressable>
        </View>

        {/* ───── LINK INPUT ───── */}
        <View
          style={[
            styles.analyticsCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
          ]}
        >
          <Text style={[styles.analyticsTitle, { color: textPrimary }]}>
            Paste Product Link
          </Text>

          <TextInput
            value={dealUrl}
            onChangeText={setDealUrl}
            placeholder="https://amazon.com/product..."
            placeholderTextColor={textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: inputBg,
                borderColor: inputBorder,
                color: textPrimary,
              },
            ]}
            autoCapitalize="none"
          />

          <Pressable
            onPress={() => requirePremium(evaluateDeal)}
            style={styles.evalBtn}
          >
            <Text style={styles.evalText}>Evaluate Deal</Text>
          </Pressable>
        </View>

        {/* ───── PERFORMANCE ───── */}
        <View
          style={[
            styles.analyticsCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
          ]}
        >
          <Text style={[styles.analyticsTitle, { color: textPrimary }]}>
            Your Flip Performance
          </Text>

          <Text style={[styles.metric, { color: textSecondary }]}>
            Total Flips:{" "}
            <Text style={{ color: textPrimary, fontWeight: "800" }}>
              {totalFlips}
            </Text>
          </Text>

          <Text style={[styles.metric, { color: textSecondary }]}>
            Total Profit:{" "}
            <Text
              style={{
                fontWeight: "800",
                color: totalProfit >= 0 ? "#2ecc71" : "#e74c3c",
              }}
            >
              ${totalProfit.toFixed(2)}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: "900" },
  logoWrap: { alignItems: "center", marginVertical: 14 },
  logo: { height: 70, width: "90%" },
  row: { flexDirection: "row", gap: 12 },
  card: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  cardTitle: { marginTop: 10, fontWeight: "800", fontSize: 16 },
  cardSub: { fontSize: 13, marginTop: 2 },
  analyticsCard: { marginTop: 22, padding: 16, borderRadius: 14, borderWidth: 1 },
  analyticsTitle: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
  metric: { fontSize: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  evalBtn: {
    backgroundColor: "#ff8c00",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  evalText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});