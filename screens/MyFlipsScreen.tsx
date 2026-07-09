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

type Sale = { price: number; soldAt: number }; // soldAt = epoch millis

type Flip = {
  id: string;
  title?: string;
  buyPrice?: number;       // per unit
  taxCost?: number;        // per unit
  shippingCost?: number;   // per unit
  feesCost?: number;       // per unit
  sellPrice?: number;      // target per unit
  soldPrice?: number;      // legacy single sold price
  quantity?: number;       // units bought (default 1)
  sales?: Sale[];          // per-unit sale records
  investedAmount?: number; // legacy
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
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [buyInput, setBuyInput] = useState("");
  const [taxInput, setTaxInput] = useState("");
  const [shipInput, setShipInput] = useState("");
  const [feesInput, setFeesInput] = useState("");
  const [sellInput, setSellInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [salePriceInput, setSalePriceInput] = useState("");
  const [sortMode, setSortMode] = useState<"timestamp" | "roi" | "profit">("timestamp");
  const [statusFilter, setStatusFilter] = useState<FlipStatus | "all">("all");

  /* ───────── Derived ───────── */
  const qtyOf = (f: Flip) => Math.max(1, Math.floor(f.quantity ?? 1));

  // Migrate legacy single soldPrice into sales view (read-only shim).
  const salesOf = (f: Flip): Sale[] => {
    if (f.sales && f.sales.length) return f.sales;
    if (f.soldPrice !== undefined && (f.status === "sold")) {
      return [{ price: f.soldPrice, soldAt: f.soldAt?.toMillis?.() ?? (f.soldAt?.seconds ? f.soldAt.seconds * 1000 : Date.now()) }];
    }
    return [];
  };

  const unitsSold = (f: Flip) => Math.min(salesOf(f).length, qtyOf(f));
  const unitsLeft = (f: Flip) => qtyOf(f) - unitsSold(f);

  const perUnitCost = (f: Flip) => {
    if (f.buyPrice !== undefined || f.taxCost !== undefined || f.shippingCost !== undefined || f.feesCost !== undefined) {
      return (f.buyPrice ?? 0) + (f.taxCost ?? 0) + (f.shippingCost ?? 0) + (f.feesCost ?? 0);
    }
    return (f.investedAmount ?? 0) / qtyOf(f);
  };

  const totalInvested = (f: Flip) => perUnitCost(f) * qtyOf(f);
  const revenueSoFar = (f: Flip) => salesOf(f).reduce((sum, s) => sum + (s.price || 0), 0);

  const statusOf = (f: Flip): FlipStatus => {
    if (f.status === "returned") return "returned";
    if (qtyOf(f) > 0 && unitsSold(f) >= qtyOf(f)) return "sold";
    return f.status === "sold" ? "sold" : (f.status ?? "inventory");
  };

  // Realized: revenue from sold units minus their share of cost.
  const realizedProfit = (f: Flip) =>
    statusOf(f) === "returned" ? 0 : revenueSoFar(f) - perUnitCost(f) * unitsSold(f);

  // Projected: remaining units at target price.
  const projectedProfit = (f: Flip) =>
    statusOf(f) === "returned" ? 0 : unitsLeft(f) * ((f.sellPrice ?? 0) - perUnitCost(f));

  const combinedProfit = (f: Flip) => realizedProfit(f) + projectedProfit(f);

  const calcROI = (f: Flip) => {
    const inv = totalInvested(f);
    if (inv <= 0) return 0;
    return (combinedProfit(f) / inv) * 100;
  };

  const TARGET_ROI = 30;
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
      if (st === "returned") return;
      realized += realizedProfit(f);
      projected += projectedProfit(f);
      invested += perUnitCost(f) * unitsLeft(f); // cash still tied up in unsold units
      salesOf(f).forEach((s) => {
        const unitProfit = (s.price || 0) - perUnitCost(f);
        if (now - s.soldAt < 86400000) today += unitProfit;
        if (now - s.soldAt < 7 * 86400000) week += unitProfit;
      });
    });
    return { realized, projected, today, week, invested, counts };
  }, [flips]);

  /* ───────── Exports ───────── */
  const BASE_DIR =
    (FileSystem as any).documentDirectory ??
    (FileSystem as any).cacheDirectory ?? "";

  const exportCSV = async () => {
    if (!flips.length || !BASE_DIR) return;
    const header = "Title,Status,Qty,Sold Units,Per-Unit Cost,Total Invested,Revenue,Realized Profit,Projected Profit,ROI %,Source,Timestamp\n";
    const rows = flips.map((f) => {
      const inv = totalInvested(f);
      const roi = inv > 0 ? ((combinedProfit(f) / inv) * 100).toFixed(1) : "0";
      let ts = "";
      if (f.timestamp?.toMillis) ts = new Date(f.timestamp.toMillis()).toISOString();
      else if (f.timestamp?.seconds) ts = new Date(f.timestamp.seconds * 1000).toISOString();
      return `"${(f.title || "Manual Flip").replace(/"/g, '""')}",${statusOf(f)},${qtyOf(f)},${unitsSold(f)},${perUnitCost(f).toFixed(2)},${inv.toFixed(2)},${revenueSoFar(f).toFixed(2)},${realizedProfit(f).toFixed(2)},${projectedProfit(f).toFixed(2)},${roi},"${f.source || ""}",${ts}`;
    }).join("\n");
    const fileUri = `${BASE_DIR}my_flips.csv`;
    await FileSystem.writeAsStringAsync(fileUri, header + rows);
    await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export My Flips (CSV)" });
  };

  const exportPDF = async () => {
    if (!flips.length) return;
    const rows = flips.map((f) => {
      const inv = totalInvested(f);
      const roi = inv > 0 ? ((combinedProfit(f) / inv) * 100).toFixed(1) : "0";
      const st = STATUS_META[statusOf(f)];
      const profit = realizedProfit(f);
      return `<tr>
        <td>${(f.title || "Manual Flip").replace(/</g, "&lt;")}</td>
        <td>${st.emoji} ${st.label}</td>
        <td>${unitsSold(f)}/${qtyOf(f)}</td>
        <td>$${inv.toFixed(2)}</td>
        <td>$${revenueSoFar(f).toFixed(2)}</td>
        <td style="color:${profit >= 0 ? "#2ecc71" : "#e74c3c"}">$${profit.toFixed(2)}</td>
        <td>${roi}%</td>
      </tr>`;
    }).join("");
    const html = `<html><body style="font-family:-apple-system;padding:24px;">
      <h1>FlashRadar – My Flips</h1>
      <p><strong>Realized Profit:</strong> $${stats.realized.toFixed(2)}<br/>
      <strong>Projected (open units):</strong> $${stats.projected.toFixed(2)}<br/>
      <strong>Cash in Inventory:</strong> $${stats.invested.toFixed(2)}</p>
      <table width="100%" border="1" cellspacing="0" cellpadding="8">
        <thead><tr><th>Title</th><th>Status</th><th>Sold</th><th>Invested</th><th>Revenue</th><th>Realized</th><th>ROI</th></tr></thead>
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
    await flipRef(flip.id).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  };

  // ── Record one unit sold at a (possibly negotiated) price ──
  const recordSale = async (flip: Flip) => {
    if (!user) return;
    const price = Number(salePriceInput);
    if (Number.isNaN(price) || price < 0) {
      Alert.alert("Invalid price", "Enter the price this unit sold for.");
      return;
    }
    const newSales: Sale[] = [...salesOf(flip), { price, soldAt: Date.now() }];
    const soldOut = newSales.length >= qtyOf(flip);

    const update: any = {
      sales: newSales,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (soldOut) {
      update.status = "sold";
      update.soldAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    await flipRef(flip.id).update(update);
    setSellingId(null);
    setSalePriceInput("");

    const profit = price - perUnitCost(flip);
    if (soldOut) {
      Alert.alert("🎉 Sold Out!", `All ${qtyOf(flip)} units sold. This unit: ${profit >= 0 ? "+" : ""}$${profit.toFixed(2)}`);
    }
  };

  const undoLastSale = async (flip: Flip) => {
    if (!user) return;
    const sales = salesOf(flip);
    if (!sales.length) return;
    const newSales = sales.slice(0, -1);
    await flipRef(flip.id).update({
      sales: newSales,
      status: flip.status === "sold" ? "listed" : flip.status ?? "inventory",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  };

  const openEditor = (flip: Flip) => {
    setSellingId(null);
    setEditingId(flip.id);
    setBuyInput(flip.buyPrice !== undefined ? String(flip.buyPrice) : "");
    setTaxInput(flip.taxCost !== undefined ? String(flip.taxCost) : "");
    setShipInput(flip.shippingCost !== undefined ? String(flip.shippingCost) : "");
    setFeesInput(flip.feesCost !== undefined ? String(flip.feesCost) : "");
    setSellInput(flip.sellPrice !== undefined ? String(flip.sellPrice) : "");
    setQtyInput(String(qtyOf(flip)));
  };

  const closeEditor = () => {
    setEditingId(null);
    setBuyInput(""); setTaxInput(""); setShipInput("");
    setFeesInput(""); setSellInput(""); setQtyInput("");
  };

  const saveCosts = async (flip: Flip) => {
    if (!user) return;
    const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
    const buy = num(buyInput), tax = num(taxInput), ship = num(shipInput), fees = num(feesInput);
    const sell = num(sellInput);
    const qty = Math.max(1, Math.floor(Number(qtyInput) || 1));

    if ([buy, tax, ship, fees, sell].some(Number.isNaN)) {
      Alert.alert("Invalid price", "Enter valid numbers");
      return;
    }
    if (qty < salesOf(flip).length) {
      Alert.alert("Quantity too low", `You already recorded ${salesOf(flip).length} sales.`);
      return;
    }

    const perUnit = buy + tax + ship + fees;
    const roi = perUnit > 0 ? ((sell - perUnit) / perUnit) * 100 : 0;
    const tier = roiTierFor(roi);
    const becameFire = tier === "FIRE" && flip.roiTier !== "FIRE";

    await flipRef(flip.id).update({
      buyPrice: buy,
      taxCost: tax,
      shippingCost: ship,
      feesCost: fees,
      sellPrice: sell,
      quantity: qty,
      investedAmount: perUnit * qty, // legacy sync
      roiTier: tier,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    closeEditor();
    if (becameFire) Alert.alert("🔥 FIRE Flip!", `${flip.title || "Flip"} hit 75%+ ROI per unit`);
  };

  /* ───────── Sorting + Filtering ───────── */
  const visibleFlips = useMemo(() => {
    let list = statusFilter === "all" ? [...flips] : flips.filter((f) => statusOf(f) === statusFilter);
    if (sortMode === "profit") return list.sort((a, b) => combinedProfit(b) - combinedProfit(a));
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
          const qty = qtyOf(flip);
          const sold = unitsSold(flip);
          const left = unitsLeft(flip);
          const invested = totalInvested(flip);
          const realized = realizedProfit(flip);
          const projected = projectedProfit(flip);
          const roi = calcROI(flip);
          const badge = badgeFor(realized + projected, roi);
          const roiTierBadge = roiBadge(roi);
          const sales = salesOf(flip);

          return (
            <Swipeable
              key={flip.id}
              enabled={editingId !== flip.id && sellingId !== flip.id}
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

                <Text style={{ color: stMeta.color, fontWeight: "800", marginTop: 2 }}>
                  {stMeta.emoji} {stMeta.label}
                  {qty > 1 ? `  •  ${sold}/${qty} sold` : ""}
                  {flip.source ? `  •  from ${flip.source}` : ""}
                </Text>

                <Text style={{ color: textSecondary, marginTop: 4 }}>
                  {qty > 1
                    ? `${qty} × $${perUnitCost(flip).toFixed(2)} = $${invested.toFixed(2)} invested  •  Target $${(flip.sellPrice ?? 0).toFixed(2)}/unit`
                    : `Invested $${invested.toFixed(2)}  •  Target $${(flip.sellPrice ?? 0).toFixed(2)}`}
                </Text>

                {sold > 0 && (
                  <Text style={{ color: green, fontWeight: "900" }}>
                    Realized ${realized.toFixed(2)} from {sold} sale{sold > 1 ? "s" : ""} (${revenueSoFar(flip).toFixed(2)} revenue)
                  </Text>
                )}
                {left > 0 && st !== "returned" && (
                  <Text style={{ color: accent, fontWeight: "800" }}>
                    Projected +${projected.toFixed(2)} on {left} remaining
                  </Text>
                )}
                {st !== "returned" && (
                  <Text style={{ color: (realized + projected) >= 0 ? green : red, fontWeight: "900" }}>
                    Total {(realized + projected) >= 0 ? "+" : ""}${(realized + projected).toFixed(2)} • ROI {roi.toFixed(1)}%
                  </Text>
                )}

                {/* Individual sales list */}
                {sales.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {sales.map((s, i) => (
                      <Text key={i} style={{ color: textSecondary, fontSize: 12 }}>
                        💰 Unit {i + 1}: ${s.price.toFixed(2)} — {new Date(s.soldAt).toLocaleDateString()}
                      </Text>
                    ))}
                    <Pressable onPress={() => undoLastSale(flip)}>
                      <Text style={{ color: red, fontSize: 12, marginTop: 2 }}>Undo last sale</Text>
                    </Pressable>
                  </View>
                )}

                {/* Record Sale inline form */}
                {sellingId === flip.id ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: textPrimary, fontWeight: "800" }}>Unit {sold + 1} of {qty} — sold for:</Text>
                    <TextInput
                      value={salePriceInput}
                      onChangeText={setSalePriceInput}
                      keyboardType="numeric"
                      placeholder={flip.sellPrice ? `Target was $${flip.sellPrice}` : "Sale price"}
                      placeholderTextColor={textSecondary}
                      style={[styles.input, { color: textPrimary, borderColor: green }]}
                      autoFocus
                    />
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <Pressable style={[styles.saveBtn, { flex: 1, backgroundColor: green, marginTop: 0 }]} onPress={() => recordSale(flip)}>
                        <Text style={styles.saveText}>Record Sale</Text>
                      </Pressable>
                      <Pressable style={[styles.saveBtn, { flex: 1, backgroundColor: "#555", marginTop: 0 }]} onPress={() => { setSellingId(null); setSalePriceInput(""); }}>
                        <Text style={styles.saveText}>Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : editingId !== flip.id && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {left > 0 && st !== "returned" && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: green }]} onPress={() => { setEditingId(null); setSellingId(flip.id); setSalePriceInput(flip.sellPrice ? String(flip.sellPrice) : ""); }}>
                        <Text style={styles.statusBtnText}>💰 Record Sale{qty > 1 ? ` (${left} left)` : ""}</Text>
                      </Pressable>
                    )}
                    {st === "inventory" && (
                      <Pressable style={[styles.statusBtn, { backgroundColor: STATUS_META.listed.color }]} onPress={() => setStatus(flip, "listed")}>
                        <Text style={styles.statusBtnText}>🏷 Mark Listed</Text>
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
                      <TextInput value={qtyInput} onChangeText={setQtyInput} keyboardType="numeric" placeholder="Qty" placeholderTextColor={textSecondary} style={[styles.input, { color: textPrimary, borderColor: accent, width: 80 }]} />
                      <TextInput value={buyInput} onChangeText={setBuyInput} keyboardType="numeric" placeholder="Buy price / unit" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput value={taxInput} onChangeText={setTaxInput} keyboardType="numeric" placeholder="Tax / unit" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                      <TextInput value={shipInput} onChangeText={setShipInput} keyboardType="numeric" placeholder="Shipping / unit" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput value={feesInput} onChangeText={setFeesInput} keyboardType="numeric" placeholder="Fees / unit" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                      <TextInput value={sellInput} onChangeText={setSellInput} keyboardType="numeric" placeholder="Target sell / unit" placeholderTextColor={textSecondary} style={[styles.input, styles.inputHalf, { color: textPrimary, borderColor: accent }]} />
                    </View>
                    <Pressable style={styles.saveBtn} onPress={() => saveCosts(flip)}>
                      <Text style={styles.saveText}>Save</Text>
                    </Pressable>
                    <Pressable onPress={closeEditor}>
                      <Text style={[styles.editText, { marginTop: 10 }]}>Cancel</Text>
                    </Pressable>
                  </>
                ) : sellingId !== flip.id && (
                  <Pressable onPress={() => openEditor(flip)}>
                    <Text style={styles.editText}>Edit Qty, Costs & Target</Text>
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
  input: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  inputHalf: { flex: 1 },
  saveBtn: { backgroundColor: "#FF8C00", paddingVertical: 10, borderRadius: 10, marginTop: 8, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "900" },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  statusBtnText: { color: "#000", fontWeight: "900", fontSize: 13 },
});
