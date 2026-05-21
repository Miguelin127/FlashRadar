// flashradar/screens/FlipHistoryScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, SectionList,
  TouchableOpacity, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";
import firebase from "firebase/compat/app";

type FlipItem = {
  id: string;
  title?: string;
  low?: number;
  high?: number;
  quantity?: number;
  timestamp?: firebase.firestore.Timestamp;
};

type Period = "month" | "quarter" | "year";

export default function FlipHistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [flips, setFlips] = useState<FlipItem[]>([]);
  const [period, setPeriod] = useState<Period>("month");

  /* ───────── Load flips ───────── */
  useEffect(() => {
    if (!user) return;

    // ── Compat SDK ────────────────────────────────────────────────────────
    const unsub = db
      .collection("users")
      .doc(user.uid)
      .collection("flips")
      .orderBy("timestamp", "desc")
      .onSnapshot((snap) => {
        const rows: FlipItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as FlipItem));
        setFlips(rows);
      });

    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    const now = new Date();
    return flips.filter((f) => {
      if (!f.timestamp) return false;
      const d = f.timestamp.toDate();
      if (period === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === "quarter") return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear();
    });
  }, [flips, period]);

  const stats = useMemo(() => {
    let revenue = 0, cost = 0;
    filtered.forEach((f) => {
      const qty = f.quantity ?? 1;
      revenue += (f.high ?? 0) * qty;
      cost += (f.low ?? 0) * qty;
    });
    return { revenue, cost, profit: revenue - cost };
  }, [filtered]);

  const exportCSV = async () => {
    if (!filtered.length) { Alert.alert("Nothing to export"); return; }
    const baseDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory;
    const path = `${baseDir}flips.csv`;
    const rows = [
      "Title,Cost,Revenue,Quantity,Date",
      ...filtered.map((f) =>
        `"${f.title ?? "Item"}",${f.low ?? 0},${f.high ?? 0},${f.quantity ?? 1},"${f.timestamp?.toDate().toISOString()}"`
      ),
    ];
    await FileSystem.writeAsStringAsync(path, rows.join("\n"));
    await Sharing.shareAsync(path);
  };

  const sections = useMemo(() => [{ title: "Saved Flips", data: filtered }], [filtered]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <View style={styles.toggleRow}>
              {(["month", "quarter", "year"] as Period[]).map((p) => (
                <TouchableOpacity key={p} onPress={() => setPeriod(p)} style={[styles.toggleBtn, period === p && styles.toggleActive]}>
                  <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>{p.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Profit Summary</Text>
              <Row label="Revenue" value={`$${stats.revenue.toFixed(2)}`} green />
              <Row label="Cost" value={`$${stats.cost.toFixed(2)}`} red />
              <Row label="Net Profit" value={`$${stats.profit.toFixed(2)}`} strong green />
            </View>
            <View style={styles.chart}>
              <Bar label="Revenue" value={stats.revenue} color="#1E9E39" />
              <Bar label="Cost" value={stats.cost} color="#E53935" />
              <Bar label="Profit" value={stats.profit} color="#FF7A00" />
            </View>
            <TouchableOpacity style={styles.exportBtn} onPress={exportCSV}>
              <Text style={styles.exportText}>Export CSV</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemTitle}>{item.title ?? "Item"}</Text>
            <Text style={styles.itemSub}>Profit: ${((item.high ?? 0) - (item.low ?? 0)) * (item.quantity ?? 1)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const Row = ({ label, value, green, red, strong }: any) => (
  <View style={styles.row}>
    <Text style={[strong && styles.bold]}>{label}</Text>
    <Text style={[strong && styles.bold, green && { color: "#1E9E39" }, red && { color: "#E53935" }]}>{value}</Text>
  </View>
);

const Bar = ({ label, value, color }: any) => (
  <View style={styles.barRow}>
    <Text style={styles.barLabel}>{label}</Text>
    <View style={[styles.bar, { width: Math.min(value / 10, 240), backgroundColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 16 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#222" },
  toggleActive: { backgroundColor: "#FF7A00" },
  toggleText: { color: "#aaa", fontSize: 12, fontWeight: "700" },
  toggleTextActive: { color: "#000" },
  summaryCard: { backgroundColor: "#111", padding: 16, borderRadius: 14, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: "#FF7A00", marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  bold: { fontWeight: "800" },
  chart: { backgroundColor: "#111", padding: 16, borderRadius: 14, marginBottom: 16 },
  barRow: { marginBottom: 10 },
  barLabel: { color: "#aaa", marginBottom: 4 },
  bar: { height: 10, borderRadius: 6 },
  exportBtn: { backgroundColor: "#FF7A00", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  exportText: { fontWeight: "800", color: "#000" },
  item: { backgroundColor: "#111", padding: 14, borderRadius: 12, marginBottom: 10 },
  itemTitle: { fontWeight: "700", color: "#fff" },
  itemSub: { color: "#aaa", marginTop: 4 },
});