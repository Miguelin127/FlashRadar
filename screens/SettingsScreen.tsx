// flashradar/screens/SettingsScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Switch, ScrollView, Share, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useUser } from "../context/UserContext";
import { registerForPushToken } from "../utils";

const CHECKOUT_URL = "https://us-central1-flashradar-71c93.cloudfunctions.net/createCheckoutSession";
const BILLING_PORTAL_URL = "https://us-central1-flashradar-71c93.cloudfunctions.net/createBillingPortal";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

export default function SettingsScreen() {
  const { colors, toggleTheme, darkMode } = useTheme();
  const { user } = useAuth();

  // ── Premium from context — no extra Firestore listener needed ────────────
  const { isPremium, subscriptionStatus } = useUser();

  const [loading, setLoading] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEnds, setTrialEnds] = useState<Date | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // ── Only fetch trial info and notification prefs — not premium status ─────
  useEffect(() => {
    if (!user) return;
    const unsub = db.collection("users").doc(user.uid).onSnapshot((snap) => {
      const d = snap.data();
      setTrialActive(!!d?.trialActive);
      setTrialEnds(d?.trialEnds?.toDate?.() ?? null);
      setNotificationsEnabled(!!d?.notificationsEnabled);
    });
    return () => unsub();
  }, [user]);

  // ── Notifications ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const unsub = db
      .collection("notifications")
      .where("uid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(5)
      .onSnapshot((snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      });
    return () => unsub();
  }, [user]);

  const markRead = async (id: string) => {
    try {
      await db.collection("notifications").doc(id).update({ read: true });
    } catch {}
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (!user) return;
    if (value) await registerForPushToken();
    await db.collection("users").doc(user.uid).update({ notificationsEnabled: value });
    setNotificationsEnabled(value);
  };

  const handleUpgrade = async () => {
    try {
      if (!user?.uid) return;
      setLoading(true);
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, plan: selectedPlan }),
      });
      const data = await res.json();
      await WebBrowser.openBrowserAsync(data.url);
    } catch {
      Alert.alert("Error", "Upgrade failed");
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      if (!user?.uid) return;
      setLoading(true);
      const res = await fetch(BILLING_PORTAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      await WebBrowser.openBrowserAsync(data.url);
    } catch {
      Alert.alert("Error", "Unable to open billing portal");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFriends = async () => {
    await Share.share({
      message: "🚀 Join me on FlashRadar and unlock powerful deal alerts: https://flashradarapp.com",
    });
  };

  const handleLogout = async () => {
    Alert.alert("Log out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: async () => await auth.signOut() },
    ]);
  };

  const TogglePill = ({ value, onToggle }: { value: boolean; onToggle: (v: boolean) => void }) => {
    const pillBg = darkMode ? "rgba(255,255,255,0.10)" : "#F2F2F2";
    const pillBorder = darkMode ? "rgba(255,255,255,0.18)" : "#D6D6D6";
    const trackOn = "#FF7A00";
    const trackOff = darkMode ? "rgba(255,255,255,0.25)" : "#CFCFCF";
    return (
      <View style={[styles.togglePill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
        <Text style={[styles.pillLabel, { color: "#FF7A00" }]}>{value ? "ON" : "OFF"}</Text>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: trackOff, true: trackOn }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={trackOff}
          style={Platform.OS === "ios" ? { transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] } : undefined}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.header, { color: colors.accent }]}>
          <Ionicons name="settings" size={18} color={colors.accent} /> Settings
        </Text>

        <View style={[styles.card, { borderColor: colors.accent }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {isPremium ? "✅ Premium Active" : "Free Plan"}
          </Text>
          {isPremium && subscriptionStatus && (
            <Text style={{ color: colors.text, marginTop: 4 }}>
              Status: {subscriptionStatus}
            </Text>
          )}
          {trialActive && trialEnds && (
            <Text style={{ color: colors.text }}>
              Trial ends {trialEnds.toLocaleDateString()}
            </Text>
          )}
        </View>

        {!isPremium && (
          <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
            <Text style={styles.buttonText}>🔓 Unlock Premium Deals</Text>
          </TouchableOpacity>
        )}

        {isPremium && (
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Alerts</Text>
          {notifications.length === 0 && <Text style={{ color: "#777" }}>No notifications yet.</Text>}
          {notifications.map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => markRead(n.id)}
              style={[styles.notification, !n.read && styles.unread]}
            >
              <Text style={{ color: colors.accent, fontWeight: "700" }}>{n.title}</Text>
              <Text style={{ color: colors.text }}>{n.message}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>Push Notifications</Text>
          <TogglePill value={notificationsEnabled} onToggle={handleToggleNotifications} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>Dark Mode</Text>
          <TogglePill value={darkMode} onToggle={() => toggleTheme()} />
        </View>

        <TouchableOpacity style={styles.button} onPress={handleInviteFriends}>
          <Text style={styles.buttonText}>Invite Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator color={colors.accent} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: 120 },
  header: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 16 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "900", marginBottom: 6 },
  notification: { paddingVertical: 8 },
  unread: { backgroundColor: "rgba(255,122,0,0.10)", borderRadius: 8, padding: 8 },
  button: { backgroundColor: "#FF7A00", padding: 14, borderRadius: 14, alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12 },
  toggleText: { fontSize: 18, fontWeight: "600" },
  togglePill: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingLeft: 14, paddingRight: 10, minWidth: 120, justifyContent: "space-between" },
  pillLabel: { fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },
  logout: { borderWidth: 2, borderColor: "#FF3B30", padding: 14, borderRadius: 14, alignItems: "center", marginTop: 10 },
  logoutText: { color: "#FF3B30", fontWeight: "900", fontSize: 18 },
});