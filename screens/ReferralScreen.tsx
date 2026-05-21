// flashradar/screens/ReferralScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Share,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "../context/ThemeContext";

let Clipboard: typeof import("expo-clipboard") | null = null;
try { Clipboard = require("expo-clipboard"); } catch { Clipboard = null; }

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Referral">;

export default function ReferralScreen() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rewardUnlocked, setRewardUnlocked] = useState(false);
  const [hasReferrals, setHasReferrals] = useState(false);
  const [referralsCount, setReferralsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { colors, darkMode } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setLoading(false); return; }

        // ── Compat SDK ──────────────────────────────────────────────────────
        const userSnap = await db.collection("users").doc(user.uid).get();

        if (userSnap.exists) {
          const data = userSnap.data();
          setReferralCode(data?.referralCode || null);
          setRewardUnlocked(!!data?.rewardGranted);
          const count = data?.referralsCount || 0;
          setReferralsCount(count);
          setHasReferrals(count > 0);
        }
      } catch (error) {
        console.error("Referral fetch error:", error);
        Alert.alert("Error", "Could not load referral info.");
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, []);

  const handleShare = async () => {
    try {
      const referralLink = referralCode
        ? `https://flashradarapp.web.app/referral?code=${referralCode}`
        : "https://flashradarapp.web.app/";
      const message = referralCode
        ? `🚀 Join me on FlashRadar! Unlock exclusive deals.\nUse my referral code: ${referralCode}\n👉 ${referralLink}`
        : `🚀 Join me on FlashRadar! Find the hottest deals 🔥\n👉 ${referralLink}`;
      await Share.share({ message });
    } catch (error) {
      Alert.alert("Error", "Could not open share menu.");
    }
  };

  const copyReferralCode = async () => {
    if (!referralCode) return;
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert("Copied ✅", "Referral code copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading referral info…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.header, { color: colors.accent }]}>🎁 Referral Reward</Text>

        <View style={[styles.rewardBox, { backgroundColor: darkMode ? "#1C1C1C" : "#FFF" }]}>
          {rewardUnlocked ? (
            <>
              <Text style={styles.emoji}>🎉</Text>
              <Text style={[styles.title, { color: colors.text }]}>Reward Unlocked!</Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>
                You've earned one free month of FlashRadar Premium!
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>🤝</Text>
              <Text style={[styles.title, { color: colors.text }]}>Invite Friends</Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>
                When 10 friends join, you'll unlock 1 month of FlashRadar Premium!
              </Text>
            </>
          )}
        </View>

        <View style={styles.progressContainer}>
          <Text style={[styles.progressLabel, { color: colors.text }]}>
            Referrals: {referralsCount}/10
          </Text>
          <View style={[styles.progressBar, { backgroundColor: darkMode ? "#333" : "#e0e0e0" }]}>
            <View style={[styles.progressFill, { width: `${Math.min((referralsCount / 10) * 100, 100)}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>

        <View style={[styles.codeBox, { backgroundColor: darkMode ? "#2A2A2A" : "#F3F3F3" }]}>
          <Text style={[styles.codeText, { color: colors.text }]}>{referralCode || "No code yet"}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>Share Invite</Text>
        </TouchableOpacity>

        {hasReferrals && (
          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => navigation.navigate("CreatorDashboard" as any)}
          >
            <Text style={styles.dashboardButtonText}>📊 View Creator Dashboard</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, alignItems: "center" },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  emoji: { fontSize: 64, textAlign: "center", marginBottom: 10 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 20 },
  rewardBox: { padding: 24, borderRadius: 16, alignItems: "center", marginBottom: 20, elevation: 2 },
  progressContainer: { width: "100%", marginBottom: 20 },
  progressLabel: { textAlign: "center", fontSize: 15, fontWeight: "600", marginBottom: 6 },
  progressBar: { height: 10, borderRadius: 10, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 10 },
  codeBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, justifyContent: "space-between", width: "100%", marginBottom: 15 },
  codeText: { fontSize: 18, fontWeight: "600" },
  copyButton: { backgroundColor: "#FF6600", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  copyButtonText: { color: "#fff", fontWeight: "600" },
  shareButton: { backgroundColor: "#FF6600", paddingVertical: 14, borderRadius: 12, alignItems: "center", width: "100%", marginBottom: 15 },
  shareButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dashboardButton: { backgroundColor: "#333", paddingVertical: 12, borderRadius: 12, alignItems: "center", width: "100%" },
  dashboardButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16 },
});