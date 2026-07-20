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
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../context/UserContext";
import { firebase, db, functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { analyzeFlip } from "../services/analyzeFlip";

import type { RootStackParamList } from "../navigation/RootNavigator";

/* ───────── CONSTANTS ───────── */

const PARSE_ENDPOINT =
  "https://us-central1-flashradar-71c93.cloudfunctions.net/parseProduct";

export default function FlipItScreen({ route }: any) {
  const { language } = useLanguage();
  const t = getStrings(language);
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
  const [pTitle, setPTitle] = useState("");
  const [pBuyPrice, setPBuyPrice] = useState("");
  const [pCondition, setPCondition] = useState("Used - Good");
  const [showFields, setShowFields] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Prefill from barcode scanner
  useEffect(() => {
    const pf = route?.params?.prefillTitle;
    if (pf) { setPTitle(String(pf).slice(0, 200)); setShowFields(true); }
  }, [route?.params?.prefillTitle]);

  // Unified analyzer — every input path (link/manual) ends here.
  const analyzeAndShow = async () => {
    const title = pTitle.trim();
    const buy = Number(pBuyPrice);
    if (!title) { Alert.alert(t.flipit.missingProduct, t.flipit.enterProductName); return; }
    if (!buy || Number.isNaN(buy) || buy <= 0) { Alert.alert(t.flipit.missingPrice, t.flipit.enterValidPrice); return; }

    setAnalyzing(true);
    let resaleMid = Math.round(buy * 1.4); // conservative fallback
    let estimate: any = null;
    try {
      const call = httpsCallable(functions, "estimateResale");
      const res: any = await call({ title, condition: pCondition, buyPrice: buy });
      estimate = res.data?.estimate ?? null;
      if (estimate?.mid && Number(estimate.mid) > 0) resaleMid = Number(estimate.mid);
    } catch (e) {
      // silent fallback to conservative default
    }

    const demand = estimate?.confidence === "high" ? "HIGH" : estimate?.confidence === "low" ? "LOW" : "MEDIUM";
    const flip = analyzeFlip({
      userId: user?.uid || "anon",
      title,
      buyPrice: buy,
      priceHistory: [{ date: Date.now(), price: buy }],
      platformInputs: {
        ebay: { resalePrice: resaleMid, buyPrice: buy, estimatedFees: Math.round(resaleMid * 0.13), demand },
        facebook: { resalePrice: resaleMid, buyPrice: buy, estimatedFees: 0, demand },
        mercari: { resalePrice: resaleMid, buyPrice: buy, estimatedFees: Math.round(resaleMid * 0.10), demand },
      },
      demand,
      dealOrigin: "MANUAL",
      source: "LINK",
    });
    setAnalyzing(false);
    navigation.navigate("FlipItResult", { flip: { ...flip, condition: pCondition, resaleEstimate: estimate } });
  };

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
    if (!dealUrl.trim() || !dealUrl.startsWith("http")) {
      Alert.alert(t.flipit.invalidLink, t.flipit.invalidUrl);
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch(PARSE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: dealUrl }),
      });
      const data = await res.json().catch(() => ({}));
      // Use whatever we got — title and/or price. Never dead-end.
      if (data?.title) setPTitle(String(data.title).slice(0, 200));
      if (data?.price) setPBuyPrice(String(data.price));
      setShowFields(true);
      setAnalyzing(false);
      if (!data?.price) {
        Alert.alert(t.flipit.almostThere, t.flipit.confirmBuyPrice);
      }
    } catch (err) {
      // Even on total failure, let them enter manually.
      setShowFields(true);
      setAnalyzing(false);
      Alert.alert(t.flipit.enterDetails, t.flipit.couldntReadLink);
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
            onPress={() => navigation.navigate("FlipScanner")}
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
            <Text style={[styles.cardTitle, { color: textPrimary }]}>{t.flipit.scanBarcode}</Text>
            <Text style={[styles.cardSub, { color: textSecondary }]}>{t.flipit.checkResale}</Text>
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
            <Text style={[styles.cardTitle, { color: textPrimary }]}>{t.flipit.myFlips}</Text>
            <Text style={[styles.cardSub, { color: textSecondary }]}>{t.flipit.liveSavedFlips}</Text>
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
            placeholder={t.flipit.urlPlaceholder}
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
            <Text style={styles.evalText}>{analyzing ? t.flipit.working : t.flipit.evaluateDeal}</Text>
          </Pressable>

          {!showFields && (
            <TouchableOpacity onPress={() => setShowFields(true)} style={{ marginTop: 12 }}>
              <Text style={{ color: "#FF7A00", fontWeight: "700", textAlign: "center" }}>or enter manually →</Text>
            </TouchableOpacity>
          )}

          {showFields && (
            <View style={{ marginTop: 14 }}>
              <TextInput
                value={pTitle}
                onChangeText={setPTitle}
                placeholder={t.flipit.namePlaceholder}
                placeholderTextColor={textSecondary}
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              />
              <TextInput
                value={pBuyPrice}
                onChangeText={setPBuyPrice}
                placeholder={t.flipit.pricePlaceholder}
                keyboardType="decimal-pad"
                placeholderTextColor={textSecondary}
                style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary, marginTop: 10 }]}
              />
              <View style={styles.condRow}>
                {[
                  { label: "New", key: t.flipit.condNew },
                  { label: "Like New", key: t.flipit.condLikeNew },
                  { label: "Used - Good", key: t.flipit.condUsedGood },
                  { label: "Used - Fair", key: t.flipit.condUsedFair }
                ].map((item) => (
                  <TouchableOpacity key={item.label} onPress={() => setPCondition(item.label)}
                    style={[styles.condChip, { borderColor: inputBorder }, pCondition === item.label && styles.condChipActive]}>
                    <Text style={[styles.condText, { color: pCondition === item.label ? "#000" : textSecondary }]}>{item.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Pressable onPress={() => requirePremium(analyzeAndShow)} style={[styles.evalBtn, { marginTop: 12 }]} disabled={analyzing}>
                {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={styles.evalText}>{t.flipit.analyzeFlip}</Text>}
              </Pressable>
            </View>
          )}
        </View>

        {/* ───── PERFORMANCE ───── */}
        <View
          style={[
            styles.analyticsCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
          ]}
        >
          <Text style={[styles.analyticsTitle, { color: textPrimary }]}>{t.flipit.performance}</Text>

          <Text style={[styles.metric, { color: textSecondary }]}>{t.flipit.totalFlips}:{" "}<Text style={{ color: textPrimary, fontWeight: "800" }}>{totalFlips}</Text></Text>

          <Text style={[styles.metric, { color: textSecondary }]}>{t.flipit.totalProfit}:{" "}<Text style={{ fontWeight: "800", color: totalProfit >= 0 ? "#2ecc71" : "#e74c3c" }}>${totalProfit.toFixed(2)}</Text></Text>
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
  condRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  condChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  condChipActive: { backgroundColor: "#FF7A00", borderColor: "#FF7A00" },
  condText: { fontSize: 12, fontWeight: "700" },
  evalBtn: {
    backgroundColor: "#ff8c00",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  evalText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});