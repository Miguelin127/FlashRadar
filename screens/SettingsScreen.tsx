// flashradar/screens/SettingsScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Switch, ScrollView, Share, Platform, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { useTheme } from "../context/ThemeContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import { registerForPushToken } from "../utils";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

export default function SettingsScreen() {
  const { colors, toggleTheme, darkMode } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = getStrings(language);
  const { user, isAdmin } = useAuth();
  const navigation = useNavigation<any>();
  const { isPremium, subscriptionStatus } = useUser();

  const [loading, setLoading] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEnds, setTrialEnds] = useState<Date | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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

  const handleUpgrade = () => {
    navigation.navigate("Upgrade");
  };

  const handleManageSubscription = async () => {
    try {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } catch {
      Alert.alert("Error", "Unable to open subscription settings");
    }
  };

  const handleInviteFriends = async () => {
    await Share.share({
      message: "🚀 Join me on FlashRadar and unlock powerful deal alerts: https://flashradarapp.com",
    });
  };

  const handleLogout = async () => {
    Alert.alert(t.settings.logout, t.settings.logoutConfirm, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      t.settings.deleteAccount,
      t.settings.deleteConfirm,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t.settings.deleteAccount,
              t.settings.deleteConfirm2,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setLoading(true);
                      const uid = user?.uid;
                      if (!uid) return;
                      await db.collection("users").doc(uid).delete();
                      const savedSnap = await db.collection("savedDeals").where("uid", "==", uid).get();
                      const batch = db.batch();
                      savedSnap.docs.forEach((d) => batch.delete(d.ref));
                      await batch.commit();
                      await auth.currentUser?.delete();
                      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
                    } catch (err: any) {
                      if (err.code === "auth/requires-recent-login") {
                        Alert.alert("Re-authentication Required", "For security, please log out and log back in before deleting your account.", [{ text: "OK" }]);
                      } else {
                        Alert.alert("Error", "Account deletion failed. Please try again.");
                      }
                    } finally {
                      setLoading(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
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
          <Ionicons name="settings" size={18} color={colors.accent} /> {t.settings.title}
        </Text>

        <View style={[styles.card, { borderColor: colors.accent }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {isPremium ? t.settings.premiumActive : t.settings.freePlan}
          </Text>
          {isPremium && subscriptionStatus && (
            <Text style={{ color: colors.text, marginTop: 4 }}>Status: {subscriptionStatus}</Text>
          )}
          {trialActive && trialEnds && (
            <Text style={{ color: colors.text }}>Trial ends {trialEnds.toLocaleDateString()}</Text>
          )}
        </View>

        {!isPremium && (
          <TouchableOpacity style={styles.button} onPress={handleUpgrade}>
            <Text style={styles.buttonText}>{t.settings.unlockPremium}</Text>
          </TouchableOpacity>
        )}

        {isPremium && (
          <TouchableOpacity style={styles.button} onPress={handleManageSubscription}>
            <Text style={styles.buttonText}>{t.settings.manageSubscription}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t.settings.alerts}</Text>
          {notifications.length === 0 && <Text style={{ color: "#777" }}>{t.settings.noNotifications}</Text>}
          {notifications.map((n) => (
            <TouchableOpacity key={n.id} onPress={() => markRead(n.id)} style={[styles.notification, !n.read && styles.unread]}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>{n.title}</Text>
              <Text style={{ color: colors.text }}>{n.message}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>{t.settings.pushNotifications}</Text>
          <TogglePill value={notificationsEnabled} onToggle={handleToggleNotifications} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>{t.settings.darkMode}</Text>
          <TogglePill value={darkMode} onToggle={() => toggleTheme()} />
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: colors.text }]}>{t.settings.language}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              onPress={() => setLanguage("en")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: language === "en" ? "#FF7A00" : (darkMode ? "rgba(255,255,255,0.10)" : "#F2F2F2"),
              }}
            >
              <Text style={{ color: language === "en" ? "#FFF" : colors.text, fontWeight: "600", fontSize: 13 }}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLanguage("es")}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: language === "es" ? "#FF7A00" : (darkMode ? "rgba(255,255,255,0.10)" : "#F2F2F2"),
              }}
            >
              <Text style={{ color: language === "es" ? "#FFF" : colors.text, fontWeight: "600", fontSize: 13 }}>ES</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleInviteFriends}>
          <Text style={styles.buttonText}>{t.settings.inviteFriends}</Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            onPress={() => navigation.navigate("AdminPostDeal")}
            style={{ backgroundColor: "#FF7A00", padding: 14, borderRadius: 12, alignItems: "center", marginBottom: 10 }}
          >
            <Text style={{ color: "#000", fontWeight: "900", fontSize: 15 }}>{t.settings.postDeal}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t.settings.logout}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>{t.settings.deleteAccount}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}
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
  deleteAccount: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  deleteAccountText: { color: "#888", fontWeight: "600", fontSize: 14, textDecorationLine: "underline" },
});