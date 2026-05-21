// flashradar/screens/AlertsScreen.tsx

import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { db } from "../firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function AlertsScreen() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── Previously hardcoded "demo-user" — nobody's real alerts ever loaded ──
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // ── Compat SDK ───────────────────────────────────────────────────────────
    const unsub = db
      .collection("users")
      .doc(user.uid)
      .collection("alerts")
      .orderBy("createdAt", "desc")
      .limit(50)
      .onSnapshot(
        (snap) => {
          setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setLoading(false)
      );

    return () => unsub();
  }, [user?.uid]);

  const markRead = async (alertId: string) => {
    if (!user?.uid) return;
    await db
      .collection("users")
      .doc(user.uid)
      .collection("alerts")
      .doc(alertId)
      .update({ read: true });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6600" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {alerts.length === 0 && (
        <Text style={styles.empty}>No alerts yet.</Text>
      )}
      <FlatList
        data={alerts}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.read && styles.read]}
            onPress={() => markRead(item.id)}
          >
            <Text style={styles.title}>{item.message}</Text>
            <Text style={styles.sub}>
              {item.type === "FLIP_READY" ? "🔥 Flip Ready" : ""}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0e0e", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0e0e0e" },
  card: { padding: 14, borderRadius: 10, backgroundColor: "#1a1a1a", marginBottom: 10 },
  read: { opacity: 0.5 },
  title: { color: "#fff", fontWeight: "700" },
  sub: { color: "#aaa", marginTop: 4, fontSize: 12 },
  empty: { color: "#777", textAlign: "center", marginTop: 40 },
});