// flashradar/screens/MyFlipsScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, TextInput, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { db, firebase } from "../firebaseConfig";

type RoiTier = "GOOD" | "STRONG" | "FIRE" | null;
type FlipStatus = "inventory" | "listed" | "sold" | "returned";

type Flip = {
  id: string;
  title?: string;
  buyPrice?: number;
  taxCost?: number;
  shippingCost?: number;
  feesCost?: number;
  sellPrice?: number;      // target/listed price
  soldPrice?: number;      // actual sale price
  investedAmount?: number; // legacy field
  status?: FlipStatus;
  soldAt?: any;
  timestamp?: any;
  source?: string;
  roiTier?: RoiTier;
};

const STATUS_META: Record<FlipStatus, { label: string; emoji: string; color: string }> = {
  inventory: { label: "In Inventory", emoji: "📦", color: "#3498db" },
  listed:    { label: "Listed",       emoji: "🏷",  color: "#f1c40f" },
  sold:      { label: "Sold",         emoji: "💰", color: "#2ecc71" },
  returned:  { label: "Returned",     emoji: "↩️", color: "#e74c3c" },
};

const STATUS_ORDER: FlipStatus[] = ["inventory", "listed", "sold", "returned"];

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
  const [buyInput, setBuyInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [shipInput, setShipInput] = useState("");
  const [feesInput, setFeesInput] = useState("");
  const [sellInput, setSellInput] = useState("");
  const [soldInput, setSoldInput] = useState("");
  const [sortMode, setSortMode] = useState<"timestamp" | "roi" | "profit">("timestamp");
  const [statusFilter, setStatusFilter] = useState<FlipStatus | "all">("all");

  /* ───────── Derived numbers ───────── */
  const statusOf = (f: Flip): FlipStatus => f.status ?? "inventory";

  // Total cash out the door: buy + tax + shipping + fees (legacy investedAmount fallback)
  const getInvested = (f: Flip) => {
    if (f.buyPrice !== undefined || f.taxCost !== undefined || f.shippingCost !== undefined || f.feesCost !== undefined) {
      return (f.buyPrice ?? 0) + (f.taxCost ?? 0) + (f.shippingCost ?? 0) + (f.feesCost ?? 0);
    }
    return f.investedAmount ?? 0;
  };

  // Realized profit only counts when sold; otherwise projected from target sellPrice.
  const effectiveSell = (f: Flip) =>
    statusOf(f) === "sold" ? (f.soldPrice ?? f.sellPrice ?? 0) : (f.sellPrice ?? 0);

  const calcProfit = (f: Flip) => {
    if (statusOf(f) === "returned") return 0;
    return effectiveSell(f) - getInvested(f);
  };

  const calcROI = (f: Flip) => {
    const invested = getInvested(f);
    if (invested <= 0) return 0;
    return (calcProfit(f) / invested) * 100;
  };

  const TARGET_ROI = 30;
  const targetSellFor = (invested: number, roiPercent: number) =>
    invested > 0 ? invested * (1 + roiPercent / 100) : 0;

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

  const badgeFor = (profit: number, roi: number) => {
    if (roi >= 100) return { label: "🦄 RARE", color: purple };
    if (profit >= 20) return { label: "🔥 HOT", color: accent };
    if (profit < 0) return { label: "❄️ COLD", color: red };
    return null;
  };

  /* ───────── Firestore Live ───────── */
  useEffect(() => {
    if (!user) return;
    const unsub = db
      .collection("users")
      .doc(user.uid)
      .collection("flips")
      .orderBy("timestamp", "desc")
      .onSnapshot((snap) => {
        const rows: Flip[] = snap.docs.map((d) => ({
          ...(d.data() as Omit<Flip, "id">),
          id: d.id,
        }));
        setFlips(rows);
      });
    return () => unsub();
  }, [user]);

  /* ───────── Stats ───────── */
  const stats = useMemo(() => {
    let realized = 0, projected = 0, today = 0, week = 0, invested = 0;
    const counts: Record<FlipStatus, number> = { inventory: 0, listed: 0, sold: 0, returned: 0 };
    const now = Date.now();
    flips.forEach((f) => {
      const st = statusOf(f);
      counts[st]++;
      const profit = calcProfit(f);
      if (st === "sold") {
        realized += profit;
        let ts = 0;
        const t = f.soldAt ?? f.timestamp;
        if (t?.toMillis) ts = t.toMillis();
        else if (t?.seconds) ts = t.seconds * 1000;
        if (now - ts < 86400000) today += profit;
        if (now - ts < 7 * 86400000) week += profit;
      } else if (st !== "returned") {
        projected += profit;
        invested += getInvested(f);
      }
    });
    return { realized, projected, today, week, invested, counts };
  }, [flips]);

  /* ───────── Exports ───────── */
  const BASE_DIR =
    (FileSystem as any).documentDirectory ??
    (FileSystem as any).cacheDirectory ?? "";

  const exportCSV = async () => {
    if (!flips.length || !BASE_DIR) return;
    const header = "Title,Status,Buy,Tax,Shipping,Fees,Invested,Target Sell,Sold Price,Profit,ROI %,Source,Timestamp\n";
    const rows = flips.map((f) => {
      const invested = getInvested(f);
      const profit = calcProfit(f);
      const roi = invested > 0 ? ((profit / invested) * 100).toFixed(1) : "0";
      let ts = "";
      if (f.timestamp?.toMillis) ts = new Date(f.timestamp.toMillis()).toISOString();
      else if (f.timestamp?.seconds) ts = new Date(f.timestamp.seconds * 1000).toISOString();
      return `"${(f.title || "Manual Flip").replace(/"/g, '""')}",${statusOf(f)},${f.buyPrice ?? 0},${f.taxCost ?? 0},${f.shippingCost ?? 0},${f.feesCost ?? 0},${invested},${f.sellPrice ?? 0},${f.soldPrice ?? ""},${profit.toFixed(2)},${roi},"${f.source || ""}",${ts}`;
    }).join("\n");
    const fileUri = `${BASE_DIR}my_flips.csv`;
    await FileSystem.writeAsStringAsync(fileUri, header + rows);
    await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export My Flips (CSV)" });
  };

  const exportPDF = async () => {
    if (!flips.length) return;
    const rows = flips.map((f) => {
      const invested = getInvested(f);
      const profit = calcProfit(f);
      const roi = invested > 0 ? ((profit / invested) * 100).toFixed(1) : "0";
      const st = STATUS_META[statusOf(f)];
      return `<tr>
        <td>${(f.title || "Manual Flip").replace(/</g, "&lt;")}</td>
        <td>${st.emoji} ${st.label}</td>
        <td>$${invested.toFixed(2)}</td>
        <td>$${effectiveSell(f).toFixed(2)}</td>
        <td style="color:${profit >= 0 ? "#2ecc71" : "#e74c3c"}">$${profit.toFixed(2)}</td>
        <td>${roi}%</td>
      </tr>`;
    }).join("");
    const html = `<html><body style="font-family:-apple-system;padding:24px;">
      <h1>FlashRadar – My Flips</h1>
      <p><strong>Realized Profit:</strong> $${stats.realized.toFixed(2)}<br/>
      <strong>Projected (open items):</strong> $${stats.projected.toFixed(2)}<br/>
      <strong>Cash in Inventory:</strong> $${stats.invested.toFixed(2)}</p>
      <table width="100%" border="1" cellspacing="0" cellpadding="8">
        <thead><tr><th>Title</th><th>Status</th><th>Invested</th><th>Sell</th><th>Profit</th><th>ROI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Export My Flips (PDF)" });
  };

  /* ───────── Mutations ───────── */
  const flipRef = (id: string) =>
    db.collection("users").doc(user!.uid).collection("flips").doc(id);

  const deleteFlip = async (id: string) => {
    if (!user) return;
    await flipRef(id).delete();
  };

  const setStatus = async (flip: Flip, status: FlipStatus) => {
    if (!user) return;
    const update: any = { status, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (status === "sold") {
      update.soldAt = firebase.firestore.FieldValue.serverTimestamp();
      // If no soldPrice recorded yet, prompt via edit mode instead of guessing.
      if (flip.soldPrice === undefined) {
        openEditor(flip);
      }
    }
    await flipRef(flip.id).update(update);
  };

  const openEditor = (flip: Flip) => {
    setEditingId(flip.id);
    setBuyInput(flip.buyPrice !== undefined ? String(flip.buyPrice) : String(flip.investedAmount ?? ""));
    setTaxInput(flip.taxCost !== undefined ? String(flip.taxCost) : "");
    setShipInput(flip.shippingCost !== undefined ? String(flip.shippingCost) : "");
    setFeesInput(flip.feesCost !== undefined ? String(flip.feesCost) : "");
    setSellInput(flip.sellPrice !== undefined ? String(flip.sellPrice) : "");
    setSoldInput(flip.soldPrice !== undefined ? String(flip.soldPrice) : "");
  };

  const closeEditor = () => {
    setEditingId(null);
    setBuyInput(""); setTaxInput(""); setShipInput("");
    setFeesInput(""); setSellInput(""); setSoldInput("");
  };

  const saveCosts = async (flip: Flip) => {
    if (!user) return;
    const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
    const buy = num(buyInput), tax = num(taxInput), ship = num(shipInput), fees = num(feesInput);
    const sell = num(sellInput);
    const sold = soldInput.trim() === "" ? undefined : Number(soldInput);

    if ([buy, tax, ship, fees, sell].some(Number.isNaN) || (sold !== undefined && Number.isNaN(sold))) {
      Alert.alert("Invalid price", "Enter valid numbers");
      return;
    }

    const invested = buy + tax + ship + fees;
    const finalSell = sold ?? sell;
    const roi = invested > 0 ? ((finalSell - invested) / invested) * 100 : 0;
    const tier = roiTierFor(roi);
    const becameFire = tier === "FIRE" && flip.roiTier !== "FIRE";

    const update: any = {
      buyPrice: buy,
      taxCost: tax,
      shippingCost: ship,
      feesCost: fees,
      sellPrice: sell,
      investedAmount: invested, // keep legacy field in sync
      roiTier: tier,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (sold !== undefined) update.soldPrice = sold;

    await flipRef(flip.id).update(update);
    closeEditor();
    if (becameFire) Alert.alert("🔥 FIRE Flip!", `${flip.title || "Flip"} hit 75%+ ROI`);
  };

  /* ───────── Sorting + Filtering ───────── */
  const visibleFlips = useMemo(() => {
    let list = statusFilter === "all" ? [...flips] : flips.filter((f) => statusOf(f) === statusFilter);
    if (sortMode === "profit") return list.sort((a, b) => calcProfit(b) - calcProfit(a));
    if (sortMode === "roi") return list.sort((a, b) => calcROI(b) - calcROI(a));
    return list;
  }, [flips, sortMode, statusFilter]);

  /* ───────── Render ───────── */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: accent }]}>🔥 MY FLIPS</Text>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Pressable onPress={() => setSortMode((m) => m === "timestamp" ? "roi" : m === "roi" ? "profit" : "timestamp")}>
              <Text style={styles.export}>Sort: {sortMode === "timestamp" ? "Time" : sortMode === "roi" ? "ROI" : "Profit"}</Text>
            </Pressable>
            <Pressable onPress={exportCSV}><Text style={styles.export}>CSV</Text></Pressable>
            <Pressable onPress={exportPDF}><Text style={styles.export}>PDF</Text></Pressable>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.summary, { backgroundColor: cardBg }]}>
          <Text style={{ color: textSecondary }}>Realized Profit: <Text style={{ color: stats.realized >= 0 ? green : red, fontWeight: "900" }}>${stats.realized.toFixed(2)}</Text></Text>
          <Text style={{ color: textSecondary }}>Today: <Text style={{ color: stats.today >= 0 ? green : red, fontWeight: "900" }}>${stats.today.toFixed(2)}</Text>  •  Week: <Text style={{ color: stats.week >= 0 ? green : red, fontWeight: "900" }}>${stats.week.toFixed(2)}</Text></Text>
          <Text style={{ color: textSecondary }}>Projected (open): <Text style={{ color: accent, fontWeight: "900" }}>${stats.projected.toFixed(2)}</Text>  •  Cash tied up: <Text style={{ color: textPrimary, fontWeight: "900" }}>${stats.invested.toFixed(2)}</Text></Text>
        </View>

        {/* Status filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            onPress={() => setStatusFilter("all")}
            style={[styles.chip, { backgroundColor: statusFilter === "all" ? accent : cardBg }]}
          >
            <Text style={{ color: statusFilter === "all" ? "#000" : textSecondary, fontWeight: "800" }}>All ({flips.length})</Text>
          </Pressable>
          {STATUS_ORDER.map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[styles.chip, { backgroundColor: statusFilter === st ? STATUS_META[st].color : cardBg }]}
            >
              <Text style={{ color: statusFilter === st ? "#000" : textSecondary, fontWeight: "800" }}>
                {STATUS_META[st].emoji} {STATUS_META[st].label} ({stats.counts[st]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {visibleFlips.length === 0 && (
          <Text style={{ color: textSecondary, textAlign: "center", marginTop: 30 }}>
            {statusFilter === "all" ? "No flips yet — analyze one from FlipIt or scan a barcode." : `No ${STATUS_META[statusFilter as FlipStatus]?.label.toLowerCase()} items.`}
          </Text>
        )}

        {visibleFlips.map((flip) => {
          const st = statusOf(flip);
          const stMeta = STATUS_META[st];
          const invested = getInvested(flip);
          const profit = calcProfit(flip);
          const roi = invested > 0 ? (profit / invested) * 100 : 0;
          const badge = badgeFor(profit, roi);
          const roiTierBadge = roiBadge(roi);
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
              <View style={[styles.card, { backgroundColor: cardBg, borderLeftWidth: 4, borderLeftColor: stMeta.color }]}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, { color: textPrimary, flex: 1, marginRight: 8 }]} numberOfLines={2}>{flip.title || "Manual Flip"}</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {roiTierBadge && <Text style={{ color: roiTierBadge.color, fontWeight: "900" }}>{roiTierBadge.label}</Text>}
                    {badge && <Text style={{ color: badge.color, fontWeight: "900" }}>{badge.label}</Text>}
                  </View>
                </View>

                <Text style={{ color: stMeta.color, fontWeight: "800", marginTop: 2 }}>{stMeta.emoji} {stMeta.label}{flip.source ? `  •  from ${flip.source}` : ""}</Text>

                <Text style={{ color: textSecondary, marginTop: 4 }}>
                  Invested ${invested.toFixed(2)} → {st === "sold" ? `Sold $${(flip.soldPrice ?? flip.sellPrice ?? 0).toFixed(2)}` : `Target $${(flip.sellPrice ?? 0).toFixed(2)}`}
                </Text>
                {st !== "returned" && (
                  <Text style={{ color: profit >= 0 ? green : red, fontWeight: "900" }}>
                    {st === "sold" ? "Profit" : "Projected"} ${profit.toFixed(2)} • ROI {roi.toFixed(1)}%
                  </Text>
                )}
                {st !== "sold" && st !== "returned" && invested > 0 && (
                  <Text style={[styles.targetLine, { color: green }]}>
                    🎯 Target @ {TARGET_ROI}% → Sell ${targetSell.toFixed(2)}
                  </Text>
                )}

                {/* Status advance buttons */}
                {editingId !== flip.id && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {st === "inventory" && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: STATUS_META.listed.color }]} onPress={() => setStatus(flip, "listed")}>
                        <Text style={styles.statusBtnText}>🏷 Mark Listed</Text>
                      </Pressable>
                    )}
                    {(st === "inventory" || st === "listed") && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: STATUS_META.sold.color }]} onPress={() => setStatus(flip, "sold")}>
                        <Text style={styles.statusBtnText}>💰 Mark Sold</Text>
                      </Pressable>
                    )}
                    {st === "sold" && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: STATUS_META.returned.color }]} onPress={() => setStatus(flip, "returned")}>
                        <Text style={styles.statusBtnText}>↩️ Returned</Text>
                      </Pressable>
                    )}
                    {st === "returned" && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: STATUS_META.inventory.color }]} onPress={() => setStatus(flip, "inventory")}>
                        <Text style={styles.statusBtnText}>📦 Back to Inventory</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {editingId === flip.id ? (
                  <>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput value={buyInput} onChangeText={setBuyInput} keyboardType="numeric" placeholder="Buy price" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                      <TextInput value={taxInput} onChangeText={setTaxInput} keyboardType="numeric" placeholder="Tax" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput value={shipInput} onChangeText={setShipInput} keyboardType="numeric" placeholder="Shipping" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                      <TextInput value={feesInput} onChangeText={setFeesInput} keyboardType="numeric" placeholder="Fees" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                    </View>
                    <TextInput value={sellInput} onChangeText={setSellInput} keyboardType="numeric" placeholder="Target sell price" placeholderTextColor={textSecondary} style={[styles.input, { color: textPrimary, borderColor: accent }]} />
                    <TextInput value={soldInput} onChangeText={setSoldInput} keyboardType="numeric" placeholder="Actual sold price (when sold)" placeholderTextColor={textSecondary} style={[styles.input, { color: textPrimary, borderColor: green }]} />
                    <Pressable style={styles.saveBtn} onPress={() => saveCosts(flip)}>
                      <Text style={styles.saveText}>Save</Text>
                    </Pressable>
                    <Pressable onPress={closeEditor}>
                      <Text style={[styles.editText, { marginTop: 10 }]}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={() => openEditor(flip)}>
                    <Text style={styles.editText}>Edit Costs & Prices</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "900" },
  export: { color: "#FF8C00", fontWeight: "900" },
  summary: { borderRadius: 14, padding: 12, marginBottom: 14, gap: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  card: { padding: 16, borderRadius: 14, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  deleteAction: { backgroundColor: "#e74c3c", justifyContent: "center", alignItems: "center", width: 90, borderRadius: 14, marginBottom: 12 },
  deleteText: { color: "#fff", fontWeight: "900" },
  editText: { color: "#FF8C00", fontWeight: "800", marginTop: 8 },
  targetLine: { marginTop: 6, fontWeight: "800" },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8, flex: undefined },
  inputHalf: { flex: 1 },
  saveBtn: { backgroundColor: "#FF8C00", paddingVertical: 10, borderRadius: 10, marginTop: 8, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "900" },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  statusBtnText: { color: "#000", fontWeight: "900", fontSize: 13 },
});
