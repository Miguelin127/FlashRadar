// flashradar/screens/MyFlipsScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/* ───────── Types ───────── */

type RoiTier = "GOOD" | "STRONG" | "FIRE" | null;

type Flip = {
  id: string;
  title?: string;

  // legacy
  buyPrice?: number;
  sellPrice?: number;

  // ✅ NEW (optional, backward-safe)
  investedAmount?: number;

  timestamp?: any;
  source?: string;
  roiTier?: RoiTier;
};

export default function MyFlipsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const isDark =
    (colors.background || "").toLowerCase() === "#000" ||
    (colors.background || "").toLowerCase() === "#000000";

  const bg = colors.background;
  const cardBg = isDark ? "#141414" : "#ffffff";
  const textPrimary = isDark ? "#ffffff" : "#111111";
  const textSecondary = isDark ? "#9e9e9e" : "#666666";
  const accent = "#FF8C00";
  const green = "#2ecc71";
  const red = "#e74c3c";
  const purple = "#9b59b6";

  const [flips, setFlips] = useState<Flip[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // editing both
  const [buyInput, setBuyInput] = useState("");
  const [sellInput, setSellInput] = useState("");

  // sorting
  const [sortMode, setSortMode] = useState<"timestamp" | "roi" | "profit">(
    "timestamp"
  );

  /* ───────── Core Math (INVESTED = buy + tax + ship) ───────── */

  const getInvested = (f: Flip) => f.investedAmount ?? f.buyPrice ?? 0;

  const calcProfit = (f: Flip) => (f.sellPrice ?? 0) - getInvested(f);

  const calcROI = (f: Flip) => {
    const invested = getInvested(f);
    if (invested <= 0) return 0;
    return (calcProfit(f) / invested) * 100;
  };

  // ✅ (2) Target sell helper (30% default)
  const TARGET_ROI = 30;
  const targetSellFor = (invested: number, roiPercent: number) => {
    if (!invested || invested <= 0) return 0;
    return invested * (1 + roiPercent / 100);
  };

  const roiTierFor = (roi: number): RoiTier => {
    if (roi >= 75) return "FIRE";
    if (roi >= 50) return "STRONG";
    if (roi >= 30) return "GOOD";
    return null;
  };

  const roiBadge = (roi: number) => {
    if (roi >= 75) return { label: "🔥 FIRE", color: red };
    if (roi >= 50) return { label: "💪 STRONG", color: accent };
    if (roi >= 30) return { label: "✅ GOOD", color: green };
    return null;
  };

  /* ───────── Existing badge (kept) ───────── */
  const badgeFor = (profit: number, roi: number) => {
    if (roi >= 100) return { label: "🦄 RARE", color: purple };
    if (profit >= 20) return { label: "🔥 HOT", color: accent };
    if (profit < 0) return { label: "❄️ COLD", color: red };
    return null;
  };

  /* ───────── Firestore Live ───────── */

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "users", user.uid, "flips"),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(q, (snap) => {
      const rows: Flip[] = [];
      snap.forEach((d) =>
        rows.push({ ...(d.data() as Omit<Flip, "id">), id: d.id })
      );
      setFlips(rows);
    });
  }, [user]);

  /* ───────── Stats ───────── */

  const stats = useMemo(() => {
    let total = 0;
    let today = 0;
    let week = 0;
    const now = Date.now();

    flips.forEach((f) => {
      const profit = calcProfit(f);
      total += profit;

      let ts = 0;
      if (f.timestamp?.toMillis) ts = f.timestamp.toMillis();
      else if (f.timestamp?.seconds) ts = f.timestamp.seconds * 1000;

      if (now - ts < 86400000) today += profit;
      if (now - ts < 7 * 86400000) week += profit;
    });

    return { total, today, week };
  }, [flips]);

  /* ───────── File base dir (TS safe) ───────── */
  const BASE_DIR =
    (FileSystem as unknown as { documentDirectory?: string }).documentDirectory ??
    (FileSystem as unknown as { cacheDirectory?: string }).cacheDirectory ??
    "";

  /* ───────── CSV Export ───────── */
  const exportCSV = async () => {
    if (!flips.length || !BASE_DIR) return;

    const header = "Title,Invested,Sell,Profit,ROI %,Source,Timestamp\n";

    const rows = flips
      .map((f) => {
        const invested = getInvested(f);
        const sell = f.sellPrice ?? 0;
        const profit = sell - invested;
        const roi = invested > 0 ? ((profit / invested) * 100).toFixed(1) : "0";

        let ts = "";
        if (f.timestamp?.toMillis) {
          ts = new Date(f.timestamp.toMillis()).toISOString();
        } else if (f.timestamp?.seconds) {
          ts = new Date(f.timestamp.seconds * 1000).toISOString();
        }

        return `"${(f.title || "Manual Flip").replace(/"/g, '""')}",${invested},${sell},${profit.toFixed(
          2
        )},${roi},"${f.source || ""}",${ts}`;
      })
      .join("\n");

    const fileUri = `${BASE_DIR}my_flips.csv`;

    await FileSystem.writeAsStringAsync(fileUri, header + rows);
    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: "Export My Flips (CSV)",
    });
  };

  /* ───────── PDF Export ───────── */
  const exportPDF = async () => {
    if (!flips.length) return;

    const rows = flips
      .map((f) => {
        const invested = getInvested(f);
        const sell = f.sellPrice ?? 0;
        const profit = sell - invested;
        const roi = invested > 0 ? ((profit / invested) * 100).toFixed(1) : "0";

        return `
          <tr>
            <td>${(f.title || "Manual Flip")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")}</td>
            <td>$${invested.toFixed(2)}</td>
            <td>$${sell.toFixed(2)}</td>
            <td style="color:${profit >= 0 ? "#2ecc71" : "#e74c3c"}">$${profit.toFixed(
          2
        )}</td>
            <td>${roi}%</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html>
        <body style="font-family:-apple-system,Roboto,Arial;padding:24px;">
          <h1>FlashRadar – My Flips</h1>
          <p>
            <strong>Today:</strong> $${stats.today.toFixed(2)}<br/>
            <strong>Week:</strong> $${stats.week.toFixed(2)}<br/>
            <strong>All Time:</strong> $${stats.total.toFixed(2)}
          </p>
          <table width="100%" border="1" cellspacing="0" cellpadding="8">
            <thead>
              <tr>
                <th align="left">Title</th>
                <th>Invested</th>
                <th>Sell</th>
                <th>Profit</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Export My Flips (PDF)",
    });
  };

  const deleteFlip = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "flips", id));
  };

  /* ───────── Save invested + sell (keeps your UI) ───────── */
  const savePrices = async (flip: Flip) => {
    if (!user) return;

    const invested = Number(buyInput);
    const sell = Number(sellInput);

    if (Number.isNaN(invested) || Number.isNaN(sell)) {
      Alert.alert("Invalid price", "Enter valid numbers");
      return;
    }

    const roi = invested > 0 ? ((sell - invested) / invested) * 100 : 0;
    const tier = roiTierFor(roi);

    const becameFire = tier === "FIRE" && flip.roiTier !== "FIRE";

    await updateDoc(doc(db, "users", user.uid, "flips", flip.id), {
      // keep legacy fields for backward compatibility
      buyPrice: invested,
      investedAmount: invested, // ✅ source of truth going forward
      sellPrice: sell,
      roiTier: tier,
      updatedAt: serverTimestamp(),
    });

    setEditingId(null);
    setBuyInput("");
    setSellInput("");

    if (becameFire) {
      Alert.alert("🔥 FIRE Flip!", `${flip.title || "Flip"} hit 75%+ ROI`);
    }
  };

  /* ───────── Sorting ───────── */
  const sortedFlips = useMemo(() => {
    const list = [...flips];

    if (sortMode === "profit") {
      return list.sort((a, b) => calcProfit(b) - calcProfit(a));
    }

    if (sortMode === "roi") {
      return list.sort((a, b) => calcROI(b) - calcROI(a));
    }

    // timestamp already desc from query
    return list;
  }, [flips, sortMode]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ✅ HEADER ROW (Sort + CSV + PDF) */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: accent }]}>🔥 MY FLIPS (LIVE)</Text>

          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Pressable
              onPress={() =>
                setSortMode((m) =>
                  m === "timestamp" ? "roi" : m === "roi" ? "profit" : "timestamp"
                )
              }
            >
              <Text style={styles.export}>
                Sort:{" "}
                {sortMode === "timestamp"
                  ? "Time"
                  : sortMode === "roi"
                  ? "ROI"
                  : "Profit"}
              </Text>
            </Pressable>

            <Pressable onPress={exportCSV}>
              <Text style={styles.export}>CSV</Text>
            </Pressable>

            <Pressable onPress={exportPDF}>
              <Text style={styles.export}>PDF</Text>
            </Pressable>
          </View>
        </View>

        {/* Summary */}
        <View style={[styles.summary, { backgroundColor: cardBg }]}>
          <Text style={{ color: textSecondary }}>
            Today:{" "}
            <Text style={{ color: stats.today >= 0 ? green : red, fontWeight: "900" }}>
              ${stats.today.toFixed(2)}
            </Text>
          </Text>

          <Text style={{ color: textSecondary }}>
            Week:{" "}
            <Text style={{ color: stats.week >= 0 ? green : red, fontWeight: "900" }}>
              ${stats.week.toFixed(2)}
            </Text>
          </Text>

          <Text style={{ color: textSecondary }}>
            All Time:{" "}
            <Text style={{ color: stats.total >= 0 ? green : red, fontWeight: "900" }}>
              ${stats.total.toFixed(2)}
            </Text>
          </Text>
        </View>

        {sortedFlips.map((flip) => {
          const invested = getInvested(flip);
          const sell = flip.sellPrice ?? 0;
          const profit = sell - invested;
          const roi = invested > 0 ? (profit / invested) * 100 : 0;

          const badge = badgeFor(profit, roi);
          const roiTierBadge = roiBadge(roi);

          // ✅ (2) target sell line (30% ROI)
          const targetSell = targetSellFor(invested, TARGET_ROI);

          return (
            <Swipeable
              key={flip.id}
              enabled={editingId !== flip.id}
              renderRightActions={() => (
                <View style={styles.deleteAction}>
                  <Text style={styles.deleteText}>Delete</Text>
                </View>
              )}
              onSwipeableRightOpen={() => deleteFlip(flip.id)}
            >
              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, { color: textPrimary }]}>
                    {flip.title || "Manual Flip"}
                  </Text>

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {roiTierBadge && (
                      <Text style={{ color: roiTierBadge.color, fontWeight: "900" }}>
                        {roiTierBadge.label}
                      </Text>
                    )}
                    {badge && (
                      <Text style={{ color: badge.color, fontWeight: "900" }}>
                        {badge.label}
                      </Text>
                    )}
                  </View>
                </View>

                <Text style={{ color: textSecondary }}>
                  Invested ${invested} → Sell ${sell}
                </Text>

                <Text style={{ color: profit >= 0 ? green : red, fontWeight: "900" }}>
                  Profit ${profit.toFixed(2)} • ROI {roi.toFixed(1)}%
                </Text>

                {/* ✅ (2) Target @ 30% (NO removals, just added) */}
                {invested > 0 && (
                  <Text style={[styles.targetLine, { color: green }]}>
                    🎯 Target @ {TARGET_ROI}% → Sell ${targetSell.toFixed(2)}
                  </Text>
                )}

                {editingId === flip.id ? (
                  <>
                    <TextInput
                      value={buyInput}
                      onChangeText={setBuyInput}
                      keyboardType="numeric"
                      placeholder="Total invested (buy + tax + ship)"
                      placeholderTextColor={textSecondary}
                      style={[styles.input, { color: textPrimary, borderColor: accent }]}
                    />

                    <TextInput
                      value={sellInput}
                      onChangeText={setSellInput}
                      keyboardType="numeric"
                      placeholder="Sell price"
                      placeholderTextColor={textSecondary}
                      style={[styles.input, { color: textPrimary, borderColor: accent }]}
                    />

                    <Pressable style={styles.saveBtn} onPress={() => savePrices(flip)}>
                      <Text style={styles.saveText}>Save</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setEditingId(null);
                        setBuyInput("");
                        setSellInput("");
                      }}
                    >
                      <Text style={[styles.editText, { marginTop: 10 }]}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditingId(flip.id);
                      setBuyInput(String(invested));
                      setSellInput(
                        flip.sellPrice !== undefined ? String(flip.sellPrice) : ""
                      );
                    }}
                  >
                    <Text style={styles.editText}>Edit Buy + Sell</Text>
                  </Pressable>
                )}
              </View>
            </Swipeable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────── Styles ───────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: "900" },
  export: { color: "#FF8C00", fontWeight: "900" },
  summary: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  deleteAction: {
    backgroundColor: "#e74c3c",
    justifyContent: "center",
    alignItems: "center",
    width: 90,
    borderRadius: 14,
    marginBottom: 12,
  },
  deleteText: { color: "#fff", fontWeight: "900" },
  editText: {
    color: "#FF8C00",
    fontWeight: "800",
    marginTop: 6,
  },
  targetLine: {
    marginTop: 6,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  saveBtn: {
    backgroundColor: "#FF8C00",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "900" },
});
