import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { auth, db } from "../firebaseConfig";
import { doc, onSnapshot } from "firebase/firestore";
import type { RootStackParamList } from "../navigation/RootNavigator";

export default function FlipItScreen() {
  const { colors, darkMode } = useTheme();
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [trialEnds, setTrialEnds] = useState<Date | null>(null);
  const [trialActive, setTrialActive] = useState<boolean>(false);

  useEffect(() => {
    const current = auth.currentUser || user;
    if (!current) {
      setIsPremium(false);
      return;
    }

    const ref = doc(db, "users", current.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        const premium = !!data?.premium;
        const trial = !!data?.trialActive;
        const trialEndDate =
          data?.trialEnds?.toDate?.() ?? null;

        setIsPremium(premium || trial);
        setTrialActive(trial);
        setTrialEnds(trialEndDate);
      },
      () => setIsPremium(false)
    );

    return () => unsub();
  }, [user]);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(overlayOpacity, {
      toValue: isPremium === false ? 1 : 0,
      duration: isPremium === false ? 400 : 250,
      useNativeDriver: true,
    }).start();
  }, [isPremium]);

  const goPremium = () => navigation.navigate("PremiumIntro");
  const goScanner = () => isPremium && navigation.navigate("FlipScanner");
  const goHistory = () => isPremium && navigation.navigate("FlipHistory");

  const daysLeft =
    trialActive && trialEnds
      ? Math.max(
          0,
          Math.ceil((trialEnds.getTime() - Date.now()) / 86400000)
        )
      : null;

  if (isPremium === null) return null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.accent }]}>Flip It</Text>

          <View
            style={[
              styles.pill,
              { backgroundColor: isPremium ? "#1E9E39" : "#999" },
            ]}
          >
            <Ionicons
              name={isPremium ? "star" : "lock-closed"}
              size={14}
              color="#fff"
            />
            <Text style={styles.pillText}>
              {isPremium ? (trialActive ? "Trial" : "Premium") : "Locked"}
            </Text>
          </View>
        </View>

        {trialActive && daysLeft !== null && (
          <View style={styles.trialNotice}>
            <Ionicons name="hourglass-outline" size={16} color={colors.accent} />
            <Text style={[styles.trialText, { color: colors.text }]}>
              {daysLeft > 0
                ? `🔥 ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                : "Trial ended"}
            </Text>
          </View>
        )}

        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/flipit_banner.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={isPremium ? 0.8 : 1}
            onPress={goScanner}
          >
            <Ionicons
              name="barcode-outline"
              size={28}
              color={isPremium ? colors.accent : "#bbb"}
            />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Scan Barcode
            </Text>
            <Text style={styles.cardSub}>
              Check resale value in seconds
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={isPremium ? 0.8 : 1}
            onPress={goHistory}
          >
            <Ionicons
              name="time-outline"
              size={28}
              color={isPremium ? colors.accent : "#bbb"}
            />
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              My Flips
            </Text>
            <Text style={styles.cardSub}>
              View saved scans & profits
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {!isPremium && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: overlayOpacity,
              backgroundColor: "rgba(0,0,0,0.65)",
              justifyContent: "center",
              alignItems: "center",
            },
          ]}
        >
          <View style={styles.upgradeCard}>
            <Text style={styles.upTitle}>Unlock Flip It Mode</Text>
            <Text style={styles.upSubtitle}>
              Scan barcodes, see resale value, and track profits in real time.
            </Text>

            <TouchableOpacity style={styles.ctaBtn} onPress={goPremium}>
              <Ionicons name="rocket-outline" size={18} color="#000" />
              <Text style={styles.ctaText}>Upgrade Now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: "800" },
  pill: {
    flexDirection: "row",
    gap: 6,
    padding: 8,
    borderRadius: 999,
  },
  pillText: { color: "#fff", fontSize: 12 },
  trialNotice: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  trialText: { fontWeight: "600" },
  logoWrap: { alignItems: "center", marginVertical: 12 },
  logo: { height: 64, width: "85%" },
  row: { flexDirection: "row", gap: 12 },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
  },
  cardTitle: { marginTop: 10, fontWeight: "700" },
  cardSub: { fontSize: 13, opacity: 0.7 },
  upgradeCard: {
    backgroundColor: "#FF7A00",
    padding: 20,
    borderRadius: 18,
    width: "85%",
    alignItems: "center",
  },
  upTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  upSubtitle: {
    color: "#fff",
    textAlign: "center",
    marginTop: 8,
  },
  ctaBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
  },
  ctaText: { fontWeight: "800" },
});
