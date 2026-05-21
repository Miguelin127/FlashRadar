// flashradar/screens/CreatorDashboard.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Alert, ActivityIndicator, Clipboard, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../context/UserContext";
import { useTheme } from "../context/ThemeContext";
import { db, firebase } from "../firebaseConfig";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type CreatorTier = "bronze" | "silver" | "gold" | "elite";

type CreatorData = {
  username: string;
  tier: CreatorTier;
  clicks: number;
  earnings: number;
  referralsCount: number;
  conversions: number;
  activeCampaigns: number;
  pendingPayout: number;
  lifetimeEarnings: number;
  referralCode: string;
};

type Campaign = {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  budget: number;
  roi: number;
  status: "active" | "paused" | "ended";
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<CreatorTier, { label: string; color: string; icon: string }> = {
  bronze: { label: "Bronze Creator", color: "#cd7f32", icon: "medal-outline" },
  silver: { label: "Silver Creator", color: "#C0C0C0", icon: "medal-outline" },
  gold:   { label: "Gold Creator",   color: "#FFD700", icon: "star-outline" },
  elite:  { label: "Elite Creator",  color: "#FF7A00", icon: "flash-outline" },
};

function conversionRate(clicks: number, conversions: number): string {
  if (!clicks) return "0.0%";
  return ((conversions / clicks) * 100).toFixed(1) + "%";
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, color, dark,
}: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap;
  color: string; dark: boolean;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: dark ? "#1a1a1a" : "#f5f5f5" }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[statStyles.value, { color: dark ? "#fff" : "#111" }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center", margin: 5 },
  value: { fontSize: 20, fontWeight: "900", marginTop: 6 },
  label: { fontSize: 11, color: "#888", marginTop: 3, textAlign: "center" },
});

function CampaignCard({ item, dark }: { item: Campaign; dark: boolean }) {
  const statusColor = item.status === "active" ? "#2ecc71" : item.status === "paused" ? "#f39c12" : "#888";
  return (
    <View style={[campStyles.card, { backgroundColor: dark ? "#1a1a1a" : "#f5f5f5" }]}>
      <View style={campStyles.row}>
        <Text style={[campStyles.name, { color: dark ? "#fff" : "#111" }]}>{item.name}</Text>
        <View style={[campStyles.badge, { backgroundColor: statusColor + "22" }]}>
          <Text style={[campStyles.badgeText, { color: statusColor }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={campStyles.metrics}>
        <Text style={campStyles.metric}>👁 {item.impressions.toLocaleString()}</Text>
        <Text style={campStyles.metric}>🖱 {item.clicks.toLocaleString()}</Text>
        <Text style={campStyles.metric}>💰 ${item.budget}</Text>
        <Text style={campStyles.metric}>📈 {item.roi}% ROI</Text>
      </View>
    </View>
  );
}

const campStyles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  name: { fontSize: 15, fontWeight: "800", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "900" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { fontSize: 12, color: "#888" },
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function CreatorDashboard() {
  const { user } = useAuth();
  const { isPremium } = useUser();
  const { colors, theme } = useTheme();
  const dark = theme === "dark";

  const [creatorData, setCreatorData] = useState<CreatorData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load creator data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      // ── Compat SDK ──────────────────────────────────────────────────────
      const userSnap = await db.collection("users").doc(user.uid).get();
      const userData = userSnap.data();

      // Build creator profile — merge Firestore data with defaults
      const profile: CreatorData = {
        username: userData?.username || user.email?.split("@")[0] || "Creator",
        tier: userData?.creatorTier || "bronze",
        clicks: userData?.totalClicks || 0,
        earnings: userData?.earnings || 0,
        referralsCount: userData?.referralsCount || 0,
        conversions: userData?.conversions || 0,
        activeCampaigns: userData?.activeCampaigns || 0,
        pendingPayout: userData?.pendingPayout || 0,
        lifetimeEarnings: userData?.lifetimeEarnings || 0,
        referralCode: userData?.referralCode || user.uid.slice(0, 8).toUpperCase(),
      };

      setCreatorData(profile);

      // Load campaigns
      const campSnap = await db
        .collection("campaigns")
        .where("uid", "==", user.uid)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();

      setCampaigns(
        campSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Campaign, "id">) }))
      );
    } catch (err) {
      console.error("[CreatorDashboard] load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // ── Referral link actions ─────────────────────────────────────────────────
  const referralLink = creatorData
    ? `https://flashradarapp.com/ref/${creatorData.referralCode}`
    : "";

  const copyLink = () => {
    if (!referralLink) return;
    Clipboard.setString(referralLink);
    Alert.alert("Copied ✅", "Referral link copied to clipboard!");
  };

  const shareLink = async () => {
    if (!referralLink) return;
    await Share.share({
      message: `🚀 Check out FlashRadar for live deals & flip opportunities!\n👉 ${referralLink}`,
    });
  };

  // ── Request payout ────────────────────────────────────────────────────────
  const requestPayout = async () => {
    if (!user || !creatorData) return;
    if (creatorData.pendingPayout < 10) {
      Alert.alert("Minimum not reached", "You need at least $10 to request a payout.");
      return;
    }
    try {
      await db.collection("payouts").add({
        uid: user.uid,
        amount: creatorData.pendingPayout,
        status: "requested",
        requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert("Payout Requested ✅", "We'll process your payout within 3-5 business days.");
    } catch {
      Alert.alert("Error", "Could not submit payout request. Try again.");
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF7A00" />
      </SafeAreaView>
    );
  }

  if (!creatorData) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Could not load creator data.</Text>
      </SafeAreaView>
    );
  }

  const tier = TIER_CONFIG[creatorData.tier];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF7A00" />}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: dark ? "#1a1a1a" : "#fff" }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: dark ? "#aaa" : "#666" }]}>
              Welcome back 👋
            </Text>
            <Text style={[styles.username, { color: dark ? "#fff" : "#111" }]}>
              {creatorData.username}
            </Text>
            <View style={styles.tierRow}>
              <Ionicons name={tier.icon as any} size={14} color={tier.color} />
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>
          </View>
          <View style={[styles.earningsBadge, { backgroundColor: "#FF7A00" + "22" }]}>
            <Text style={styles.earningsValue}>${creatorData.earnings.toFixed(2)}</Text>
            <Text style={styles.earningsLabel}>Earned</Text>
          </View>
        </View>

        {/* ── STATS ROW ──────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatCard label="Clicks" value={creatorData.clicks.toLocaleString()} icon="analytics-outline" color="#FF7A00" dark={dark} />
          <StatCard label="Referrals" value={String(creatorData.referralsCount)} icon="people-outline" color="#2ecc71" dark={dark} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Conversion" value={conversionRate(creatorData.clicks, creatorData.conversions)} icon="trending-up-outline" color="#3498db" dark={dark} />
          <StatCard label="Campaigns" value={String(creatorData.activeCampaigns)} icon="megaphone-outline" color="#9b59b6" dark={dark} />
        </View>

        {/* ── REFERRAL LINK GENERATOR ────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: dark ? "#1a1a1a" : "#fff" }]}>
          <Text style={[styles.sectionTitle, { color: dark ? "#fff" : "#111" }]}>
            🔗 Your Referral Link
          </Text>
          <View style={[styles.linkBox, { backgroundColor: dark ? "#0f0f0f" : "#f0f0f0" }]}>
            <Text style={[styles.linkText, { color: dark ? "#aaa" : "#555" }]} numberOfLines={1}>
              {referralLink}
            </Text>
          </View>
          <View style={styles.linkActions}>
            <TouchableOpacity style={[styles.linkBtn, { backgroundColor: "#FF7A00" }]} onPress={copyLink}>
              <Ionicons name="copy-outline" size={16} color="#fff" />
              <Text style={styles.linkBtnText}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkBtn, { backgroundColor: "#2ecc71" }]} onPress={shareLink}>
              <Ionicons name="share-social-outline" size={16} color="#fff" />
              <Text style={styles.linkBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── EARNINGS & PAYOUTS ─────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: dark ? "#1a1a1a" : "#fff" }]}>
          <Text style={[styles.sectionTitle, { color: dark ? "#fff" : "#111" }]}>
            💰 Earnings & Payouts
          </Text>
          <View style={styles.earningsRow}>
            <View style={styles.earningsItem}>
              <Text style={styles.earningsNum}>${creatorData.lifetimeEarnings.toFixed(2)}</Text>
              <Text style={styles.earningsMeta}>Lifetime</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsItem}>
              <Text style={[styles.earningsNum, { color: "#2ecc71" }]}>
                ${creatorData.pendingPayout.toFixed(2)}
              </Text>
              <Text style={styles.earningsMeta}>Pending</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.payoutBtn, creatorData.pendingPayout < 10 && styles.payoutBtnDisabled]}
            onPress={requestPayout}
            disabled={creatorData.pendingPayout < 10}
          >
            <Ionicons name="wallet-outline" size={18} color="#fff" />
            <Text style={styles.payoutBtnText}>
              {creatorData.pendingPayout >= 10 ? "Request Payout" : `$${(10 - creatorData.pendingPayout).toFixed(2)} more to unlock`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── CAMPAIGNS ──────────────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: dark ? "#1a1a1a" : "#fff" }]}>
          <Text style={[styles.sectionTitle, { color: dark ? "#fff" : "#111" }]}>
            📊 Your Campaigns
          </Text>
          {campaigns.length === 0 ? (
            <View style={styles.emptyCampaigns}>
              <Ionicons name="megaphone-outline" size={40} color="#555" />
              <Text style={styles.emptyText}>No campaigns yet.</Text>
              <Text style={styles.emptySubText}>
                Create your first campaign to start tracking performance.
              </Text>
            </View>
          ) : (
            campaigns.map((c) => <CampaignCard key={c.id} item={c} dark={dark} />)
          )}
        </View>

        {/* ── PROMO TOOLS ────────────────────────────────────────────────── */}
        <View style={[styles.section, { backgroundColor: dark ? "#1a1a1a" : "#fff" }]}>
          <Text style={[styles.sectionTitle, { color: dark ? "#fff" : "#111" }]}>
            🚀 Promo Tools
          </Text>
          {[
            { icon: "logo-tiktok", label: "Share to TikTok", color: "#010101" },
            { icon: "logo-instagram", label: "Share to Instagram", color: "#E1306C" },
            { icon: "logo-twitter", label: "Share to X / Twitter", color: "#1DA1F2" },
            { icon: "share-outline", label: "Share Anywhere", color: "#FF7A00" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.promoRow, { borderColor: dark ? "#2a2a2a" : "#eee" }]}
              onPress={shareLink}
            >
              <Ionicons name={item.icon as any} size={22} color={item.color} />
              <Text style={[styles.promoLabel, { color: dark ? "#fff" : "#111" }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#888" />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header: { borderRadius: 16, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 13 },
  username: { fontSize: 22, fontWeight: "900", marginVertical: 2 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  tierLabel: { fontSize: 12, fontWeight: "700" },
  earningsBadge: { padding: 12, borderRadius: 14, alignItems: "center" },
  earningsValue: { fontSize: 20, fontWeight: "900", color: "#FF7A00" },
  earningsLabel: { fontSize: 11, color: "#888", marginTop: 2 },

  // Stats
  statsRow: { flexDirection: "row", marginBottom: 0 },

  // Section
  section: { borderRadius: 16, padding: 16, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },

  // Referral link
  linkBox: { borderRadius: 10, padding: 12, marginBottom: 10 },
  linkText: { fontSize: 13 },
  linkActions: { flexDirection: "row", gap: 10 },
  linkBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6 },
  linkBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Earnings
  earningsRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  earningsItem: { flex: 1, alignItems: "center" },
  earningsNum: { fontSize: 24, fontWeight: "900", color: "#FF7A00" },
  earningsMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  earningsDivider: { width: 1, height: 40, backgroundColor: "#333" },
  payoutBtn: { backgroundColor: "#FF7A00", flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, gap: 8 },
  payoutBtnDisabled: { backgroundColor: "#444" },
  payoutBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },

  // Campaigns
  emptyCampaigns: { alignItems: "center", paddingVertical: 20 },
  emptyText: { color: "#555", fontSize: 15, fontWeight: "700", marginTop: 8 },
  emptySubText: { color: "#666", fontSize: 12, textAlign: "center", marginTop: 4 },

  // Promo
  promoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  promoLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
});