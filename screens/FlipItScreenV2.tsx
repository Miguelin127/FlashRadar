// flashradar/screens/FlipItScreenV2.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";

export default function FlipItScreenV2() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();

  const [query, setQuery] = useState("");
  const [resaleRange, setResaleRange] = useState<{ low: number; high: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannedSource, setScannedSource] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lockScale = useRef(new Animated.Value(1)).current;
  const [recentItems, setRecentItems] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);

  // 🧩 Get user premium status from Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = db.collection("users").doc(user.uid).onSnapshot((doc) => {
      setIsPremium(doc.data()?.isPremium ?? false);
    });
    return unsub;
  }, [user]);

  // ⚙️ Simulate fetching
  const handleEstimate = async (manualQuery?: string) => {
    const searchQuery = manualQuery || query;
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const base = Math.floor(Math.random() * 40) + 10;
      const low = base;
      const high = base + Math.floor(Math.random() * 30);
      setResaleRange({ low, high });

      if (user) {
        await db
          .collection("users")
          .doc(user.uid)
          .collection("flips")
          .add({
            query: searchQuery,
            low,
            high,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          });
      }
    } catch (e) {
      Alert.alert("Error", "Failed to get resale estimate.");
    } finally {
      setLoading(false);
    }
  };

  // 🌀 Lock animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockScale, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(lockScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 🌀 Fade in overlay
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  // 🔒 Overlay for non-premium
  const renderLockedOverlay = () => (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} />
      )}
      <View style={styles.lockContent}>
        <Animated.View style={{ transform: [{ scale: lockScale }] }}>
          <Ionicons name="lock-closed-outline" size={72} color="#FF6600" />
        </Animated.View>
        <Text style={styles.premiumTitle}>Flip It Mode Premium</Text>
        <Text style={styles.premiumSubtitle}>
          Unlock AI resale analytics, barcode scanning, and full Flip Tracker.
        </Text>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => navigation.navigate("PremiumIntro")}
        >
          <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.header, { color: colors.accent }]}>🌀 Flip It Mode V2</Text>
        <Text style={[styles.subheader, { color: colors.text }]}>
          Scan or search any product to estimate its resale value instantly 💰
        </Text>

        <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.text} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Enter product name or scan barcode..."
            placeholderTextColor={colors.subtext}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => handleEstimate()}
          />
          <TouchableOpacity onPress={() => navigation.navigate("FlipScanner" as never)}>
            <Ionicons name="barcode-outline" size={22} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 10 }} />}

        {resaleRange && !loading && (
          <View style={[styles.resultBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.resultHeader, { color: colors.accent }]}>Estimated Resale Value</Text>
            <Text style={[styles.resultValue, { color: colors.text }]}>
              ${resaleRange.low.toFixed(2)} – ${resaleRange.high.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={[styles.trackerBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.trackerTitle, { color: colors.text }]}>📊 Recent Tracker</Text>
          <Text style={[styles.trackerCount, { color: colors.subtext }]}>
            No recent flips or scans yet.
          </Text>
          <TouchableOpacity
            style={[styles.trackerButton, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate("FlipHistory")}
          >
            <Text style={styles.trackerButtonText}>View Full History</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.futureBox, { backgroundColor: "#222" }]}>
          <Text style={styles.futureText}>🪄 AI Flip Suggestions (Coming Soon)</Text>
        </View>
      </ScrollView>

      {!isPremium && renderLockedOverlay()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flexGrow: 1, alignItems: "center", padding: 20 },
  header: { fontSize: 26, fontWeight: "700", marginBottom: 10 },
  subheader: { fontSize: 15, textAlign: "center", marginBottom: 20 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 15,
  },
  input: { flex: 1, fontSize: 15 },
  resultBox: {
    width: "100%",
    borderRadius: 10,
    padding: 16,
    marginBottom: 15,
    alignItems: "center",
  },
  resultHeader: { fontSize: 16, fontWeight: "600", marginBottom: 5 },
  resultValue: { fontSize: 22, fontWeight: "700" },
  trackerBox: {
    width: "100%",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginBottom: 15,
  },
  trackerTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  trackerCount: { fontSize: 16, marginBottom: 8 },
  trackerButton: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
  trackerButtonText: { color: "#fff", fontWeight: "600" },
  futureBox: { width: "100%", borderRadius: 10, padding: 14, marginTop: 10 },
  futureText: { color: "#aaa", textAlign: "center", fontStyle: "italic" },

  // 🔒 Overlay styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  lockContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
    textAlign: "center",
  },
  premiumSubtitle: {
    fontSize: 14,
    color: "#ddd",
    textAlign: "center",
    marginVertical: 10,
    lineHeight: 20,
  },
  upgradeButton: {
    backgroundColor: "#FF6600",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
