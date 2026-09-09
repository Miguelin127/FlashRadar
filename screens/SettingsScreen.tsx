// flashradar/screens/SettingsScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Switch, ScrollView, Share, Platform, Linking, Image,
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
import * as ImagePicker from "expo-image-picker";

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
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    const unsub = db.collection("users").doc(user.uid).onSnapshot((snap) => {
      const d = snap.data();
      setTrialActive(!!d?.trialActive);
      setTrialEnds(d?.trialEnds?.toDate?.() ?? null);
      setNotificationsEnabled(!!d?.notificationsEnabled);
      setProfilePhoto(d?.profilePhoto || null);
      setDisplayName(d?.displayName || user.displayName || user.email?.split('@')[0] || 'User');
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

        <TouchableOpacity style={[styles.button, { backgroundColor: '#dc2626' }]} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>

  const handleChangePhoto = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);
        const uri = result.assets[0].uri;
        await db.collection("users").doc(user.uid).update({ profilePhoto: uri });
        setProfilePhoto(uri);
        Alert.alert("Success", "Profile photo updated!");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
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

        <TouchableOpacity onPress={handleChangePhoto} style={[styles.card, { borderColor: colors.accent }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={{ width: '100%', height: '100%', borderRadius: 40 }} />
              ) : (
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff' }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{displayName}</Text>
              <Text style={{ color: '#888', fontSize: 12 }}>{user?.email}</Text>
              {isAdmin && <Text style={{ color: '#FF7A00', fontSize: 11, fontWeight: '600', marginTop: 4 }}>👤 Admin</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </View>
        </TouchableOpacity>

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
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("NotificationPreferences")}>
          <Text style={styles.buttonText}>Notification Preferences</Text>
        </TouchableOpacity>
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

        <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#dc2626' }]} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log Out</Text>
        </TouchableOpacity>
          <Text style={styles.deleteAccountText}>{t.settings.deleteAccount}</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}

        <View style={{ marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#333', alignItems: 'center', paddingBottom: 20 }}>
          <Text style={{ color: '#FF7A00', fontSize: 14, fontWeight: '700' }}>FlashRadar LLC</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  header: { fontSize: 24, fontWeight: "900", marginBottom: 20 },
  card: { marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 12 },
  notification: { paddingVertical: 8, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  unread: { backgroundColor: "rgba(255,122,0,0.05)" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  toggleText: { fontSize: 14, fontWeight: "600" },
  togglePill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  pillLabel: { fontSize: 11, fontWeight: "700" },
  button: { backgroundColor: "#FF7A00", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  deleteAccount: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 8 },
  deleteAccountText: { color: "#888", fontWeight: "600", fontSize: 14, textDecorationLine: "underline" },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
});
