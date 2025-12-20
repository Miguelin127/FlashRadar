import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot as onSnapshotCol,
} from "firebase/firestore";

const CHECKOUT_URL =
  "https://us-central1-flashradar-71c93.cloudfunctions.net/createCheckoutSession";
const BILLING_PORTAL_URL =
  "https://us-central1-flashradar-71c93.cloudfunctions.net/createBillingPortal";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  createdAt?: any;
  read: boolean;
}

export default function SettingsScreen() {
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEnds, setTrialEnds] = useState<Date | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, toggleTheme, darkMode } = useTheme();
  const { user } = useAuth();

  // 🧩 Listen for Premium + trial status
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setIsPremium(!!data.premium);
      setTrialActive(!!data.trialActive);
      setTrialEnds(data.trialEnds ? data.trialEnds.toDate?.() ?? new Date(data.trialEnds) : null);
    });
    return () => unsub();
  }, [user]);

  // 🔔 Fetch latest notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshotCol(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as NotificationItem[];
      setNotifications(data);
    });
    return () => unsub();
  }, [user]);

  // ⏳ Trial countdown
  const getTrialCountdown = () => {
    if (!trialActive || !trialEnds) return null;
    const now = new Date();
    const diffMs = trialEnds.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    if (daysLeft === 0) return "⏳ Your trial ends today!";
    if (daysLeft === 1) return "⏳ Trial ends in 1 day";
    return `⏳ Trial ends in ${daysLeft} days`;
  };

  // 🔐 Logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      Alert.alert("Logged out", "You have been logged out successfully.");
    } catch {
      Alert.alert("Error", "Something went wrong while logging out.");
    }
  };

  // 💌 Invite Friends
  const handleInviteFriends = async () => {
    const message = `🚀 Join me on FlashRadar! Unlock exclusive local & online deals — plus rewards for referrals. Download now: https://flashradarapp.com`;
    try {
      await Share.share({ message });
    } catch {
      Alert.alert("Error", "Unable to share invite.");
    }
  };

  // 💳 Upgrade to Premium
  const handleUpgrade = async () => {
    try {
      setLoading(true);
      if (!user?.uid) return Alert.alert("Error", "You must be logged in to upgrade.");

      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, plan: selectedPlan }),
      });
      const data = await res.json();
      if (data?.url) await WebBrowser.openBrowserAsync(data.url);
      else throw new Error("Missing checkout URL.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Upgrade failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user?.uid) return Alert.alert("Error", "No user found.");
    try {
      setLoading(true);
      const res = await fetch(BILLING_PORTAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      if (data?.url) await WebBrowser.openBrowserAsync(data.url);
      else throw new Error("Missing billing portal URL.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Unable to open billing portal.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatorDashboard = () =>
    Alert.alert("Coming Soon 🔥", "Creator Dashboard will launch soon!");

  // ─────────────────────────── UI ───────────────────────────
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.header, { color: colors.accent }]}>⚙️ Settings</Text>

        {/* 🌟 Premium Info */}
        <View style={[styles.premiumCard, { borderColor: colors.accent }]}>
          {isPremium ? (
            <>
              <Text style={[styles.premiumTitle, { color: colors.accent }]}>
                ⭐ Premium Active
              </Text>
              {trialActive && trialEnds && (
                <Text style={[styles.trialText, { color: colors.text }]}>
                  {getTrialCountdown()}
                </Text>
              )}
            </>
          ) : (
            <Text style={{ color: colors.text }}>
              You’re currently on the Free Plan. Upgrade to unlock all features.
            </Text>
          )}
        </View>

        {/* 🔔 Notifications */}
        <View
          style={[
            styles.notificationsCard,
            {
              backgroundColor: darkMode ? "#1E1E1E" : "#fff",
              borderColor: darkMode ? "#333" : "#ddd",
            },
          ]}
        >
          <Text style={[styles.notificationsTitle, { color: colors.text }]}>
            🔔 Latest Notifications
          </Text>
          {notifications.length === 0 ? (
            <Text style={{ color: darkMode ? "#aaa" : "#444", marginTop: 6 }}>
              No notifications yet.
            </Text>
          ) : (
            notifications.map((n) => (
              <View key={n.id} style={styles.notificationItem}>
                <Text style={[styles.notificationTitle, { color: colors.accent }]}>
                  🎉 {n.title}
                </Text>
                <Text style={[styles.notificationMsg, { color: colors.text }]}>
                  {n.message}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* 💳 Subscription */}
        {!isPremium ? (
          <>
            <View style={styles.planSelectorContainer}>
              <TouchableOpacity
                style={[
                  styles.planButton,
                  selectedPlan === "monthly" && styles.activePlanButton,
                ]}
                onPress={() => setSelectedPlan("monthly")}
              >
                <Text
                  style={[
                    styles.planButtonText,
                    selectedPlan === "monthly" && styles.activePlanText,
                  ]}
                >
                  Monthly $6.99
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.planButton,
                  selectedPlan === "yearly" && styles.activePlanButton,
                ]}
                onPress={() => setSelectedPlan("yearly")}
              >
                <Text
                  style={[
                    styles.planButtonText,
                    selectedPlan === "yearly" && styles.activePlanText,
                  ]}
                >
                  Yearly $59.99
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
              <Text style={styles.buttonText}>
                {loading
                  ? "Loading..."
                  : `Upgrade to ${
                      selectedPlan === "yearly" ? "Yearly" : "Monthly"
                    } Premium`}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>
              {loading ? "Loading..." : "Manage Subscription"}
            </Text>
          </TouchableOpacity>
        )}

        {/* 🕹️ Toggles */}
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>Push Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: "#ccc", true: colors.accent }}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.darkModeLabel}>
            <Ionicons
              name={darkMode ? "moon" : "sunny"}
              size={20}
              color={colors.accent}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.toggleText, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={toggleTheme}
            trackColor={{ false: "#ccc", true: colors.accent }}
          />
        </View>

        {/* 💌 Invite Friends */}
        <TouchableOpacity style={styles.button} onPress={handleInviteFriends}>
          <Text style={styles.buttonText}>Invite Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleCreatorDashboard}>
          <Text style={styles.buttonText}>Creator Dashboard 📊</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.accent }]}>Log Out</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 20 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────── STYLES ───────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 20, textAlign: "center" },
  premiumCard: { borderWidth: 1, borderRadius: 10, padding: 15, marginBottom: 20 },
  premiumTitle: { fontSize: 18, fontWeight: "700" },
  trialText: { marginTop: 5, fontSize: 14, fontWeight: "500" },
  notificationsCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  notificationsTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  notificationItem: { paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  notificationTitle: { fontWeight: "600", fontSize: 15 },
  notificationMsg: { fontSize: 14 },
  planSelectorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  planButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FF6600",
    marginHorizontal: 6,
  },
  activePlanButton: { backgroundColor: "#FF6600" },
  planButtonText: { color: "#FF6600", fontWeight: "600" },
  activePlanText: { color: "#fff" },
  button: {
    backgroundColor: "#FF6600",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  logoutButton: {
    borderColor: "#FF6600",
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  logoutText: { fontSize: 16, fontWeight: "600" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 8,
  },
  darkModeLabel: { flexDirection: "row", alignItems: "center" },
  toggleText: { fontSize: 16 },
});
