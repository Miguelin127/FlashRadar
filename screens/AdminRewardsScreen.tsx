// flashradar/screens/AdminRewardsScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList,
  ActivityIndicator, Alert,
} from "react-native";
import { db } from "../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

type RewardEntry = {
  id: string;
  email: string;
  referrals: number;
  premiumActive: boolean;
};

export default function AdminRewardsScreen() {
  const [rewards, setRewards] = useState<RewardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        // ── Compat SDK ──────────────────────────────────────────────────────
        const snapshot = await db.collection("users").get();
        const data: RewardEntry[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          email: doc.data().email ?? "Unknown",
          referrals: doc.data().referrals ?? 0,
          premiumActive: doc.data().isPremium ?? false,
        }));
        setRewards(data);
      } catch (err: any) {
        console.error("Admin rewards error:", err);
        Alert.alert("Error", "Failed to load rewards.");
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
        <Text style={styles.loadingText}>Loading admin rewards…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>👑 Admin Rewards Dashboard</Text>
      {rewards.length === 0 ? (
        <Text style={styles.empty}>No user data available.</Text>
      ) : (
        <FlatList
          data={rewards}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.email}>{item.email}</Text>
              <Text style={styles.info}>
                Referrals: {item.referrals} | Premium:{" "}
                {item.premiumActive ? "✅" : "❌"}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  header: { fontSize: 22, fontWeight: "800", marginBottom: 16, color: "#FF6600", textAlign: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#555" },
  empty: { textAlign: "center", marginTop: 20, fontSize: 16, color: "#555" },
  card: { backgroundColor: "#f5f5f5", padding: 12, borderRadius: 8, marginBottom: 10 },
  email: { fontSize: 16, fontWeight: "600" },
  info: { fontSize: 14, color: "#333", marginTop: 4 },
});