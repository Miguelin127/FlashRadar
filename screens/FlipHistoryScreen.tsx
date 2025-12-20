// flashradar/screens/FlipHistoryScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useTheme } from "../context/ThemeContext";
import { db } from "../firebaseConfig";
import { useAuth } from "../context/AuthContext";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

type FlipItem = {
  id: string;
  query?: string;
  title?: string;
  image?: string;
  low?: number;
  high?: number;
  profit?: number | string;
  timestamp?: firebase.firestore.Timestamp;
  type: "manual" | "scan";
};

export default function FlipHistoryScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [flips, setFlips] = useState<FlipItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let flipsData: FlipItem[] = [];
    let scansData: FlipItem[] = [];

    // ✅ define merge function first
    const mergeData = () => {
      const combined = [...flipsData, ...scansData].sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() || 0;
        const tb = b.timestamp?.toMillis?.() || 0;
        return tb - ta;
      });
      setFlips(combined);
      setLoading(false);
    };

    const unsubFlips = db
      .collection("users")
      .doc(user.uid)
      .collection("flips")
      .orderBy("timestamp", "desc")
      .onSnapshot(
        (snap) => {
          flipsData = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            type: "manual" as const,
          })) as FlipItem[];
          mergeData();
        },
        (error) => console.error("Flip history error:", error)
      );

    const unsubScans = db
      .collection("users")
      .doc(user.uid)
      .collection("scans")
      .orderBy("timestamp", "desc")
      .onSnapshot(
        (snap) => {
          scansData = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            type: "scan" as const,
          })) as FlipItem[];
          mergeData();
        },
        (error) => console.error("Scan history error:", error)
      );

    return () => {
      unsubFlips();
      unsubScans();
    };
  }, [user]);

  // ──────────── Summary Metrics ────────────
  const totalFlips = flips.length;
  const avgMargin =
    totalFlips > 0
      ? flips.reduce((acc, f) => {
          if (f.low && f.high) return acc + ((f.high - f.low) / f.low) * 100;
          return acc;
        }, 0) / totalFlips
      : 0;

  const highestMargin = totalFlips
    ? Math.max(
        ...flips.map((f) =>
          f.low && f.high ? ((f.high - f.low) / f.low) * 100 : 0
        )
      )
    : 0;

  // ──────────── Export CSV ────────────
  const handleExportCSV = async () => {
    try {
      if (flips.length === 0) {
        Alert.alert("No Data", "There are no flips or scans to export yet.");
        return;
      }

      let csv = "Type,Title/Query,Low,High,Profit,Date\n";
      flips.forEach((f) => {
        const date = f.timestamp?.toDate().toLocaleDateString() ?? "—";
        const margin =
          f.low && f.high ? ((f.high - f.low) / f.low) * 100 : "—";
        csv += `${f.type},${f.query || f.title || "—"},${f.low || "—"},${
          f.high || "—"
        },${margin},${date}\n`;
      });

      const dir =
        (FileSystem as any).documentDirectory ||
        (FileSystem as any).cacheDirectory ||
        "";

      const fileUri = `${dir}flip_history.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert("Exported", `File saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error("CSV export error:", error);
      Alert.alert("Error", "Failed to export CSV file.");
    }
  };

  // ──────────── Render Item ────────────
  const renderItem = ({ item }: { item: FlipItem }) => {
    const margin =
      item.low && item.high ? ((item.high - item.low) / item.low) * 100 : null;
    const profitColor =
      margin == null
        ? colors.subtext
        : margin > 50
        ? "#4CAF50"
        : margin > 20
        ? "#FFC107"
        : "#FF5722";
    const date = item.timestamp?.toDate().toLocaleDateString() ?? "—";

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={{ width: 50, height: 50, borderRadius: 8, marginRight: 10 }}
            />
          ) : (
            <View style={styles.placeholderThumb} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.query, { color: colors.text }]}>
              {item.title || item.query || "Untitled"}
            </Text>
            <Text style={[styles.date, { color: colors.subtext }]}>{date}</Text>
            {margin !== null && (
              <Text style={[styles.margin, { color: profitColor }]}>
                Margin ≈ {margin.toFixed(1)}%
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ──────────── Group Data ────────────
  const sections = [
    {
      title: "📸 Scanned Items",
      data: flips.filter((item) => item.type === "scan"),
    },
    {
      title: "💰 Manual Estimates",
      data: flips.filter((item) => item.type === "manual"),
    },
  ].filter((section) => section.data.length > 0);

  if (loading)
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator
          size="large"
          color={colors.accent}
          style={{ marginTop: 40 }}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.accent }]}>
          🧾 Flip Tracker History
        </Text>
        <TouchableOpacity onPress={handleExportCSV}>
          <Text style={[styles.clearText, { color: colors.subtext }]}>
            📤 Export CSV
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {flips.length > 0 && (
        <View style={[styles.summaryBox, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.accent }]}>
            Summary
          </Text>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              Total Items:
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {totalFlips}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              Avg Margin:
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: avgMargin > 50 ? "#4CAF50" : "#FFC107" },
              ]}
            >
              {avgMargin.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              Highest Margin:
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { color: highestMargin > 50 ? "#4CAF50" : "#FF5722" },
              ]}
            >
              {highestMargin.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}

      {/* Data List */}
      {sections.length === 0 ? (
        <Text style={[styles.empty, { color: colors.subtext }]}>
          No flips or scans recorded yet.
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={[styles.sectionHeader, { color: colors.accent }]}>
              {title}
            </Text>
          )}
          contentContainerStyle={{ padding: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  header: { fontSize: 22, fontWeight: "700" },
  clearText: { fontSize: 14 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6,
  },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontSize: 16,
  },
  summaryBox: {
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  summaryText: { fontSize: 15, fontWeight: "500" },
  summaryValue: { fontSize: 15, fontWeight: "700" },
  card: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  row: { flexDirection: "row", alignItems: "center" },
  placeholderThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#ccc",
    marginRight: 10,
  },
  query: { fontSize: 16, fontWeight: "600" },
  margin: { fontSize: 13, fontWeight: "600" },
  date: { fontSize: 12, marginTop: 2 },
});
