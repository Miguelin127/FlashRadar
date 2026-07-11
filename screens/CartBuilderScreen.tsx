// flashradar/screens/CartBuilderScreen.tsx

import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Image, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../context/ThemeContext";
import { useUser } from "../context/UserContext";
import { functions } from "../firebaseConfig";
import { httpsCallable } from "firebase/functions";

type CartItem = {
  id: string;
  title: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  store: string;
  imageUrl: string | null;
  affiliateUrl: string | null;
  reason: string;
};

type CartResult = {
  cart: CartItem[];
  total: number;
  totalSaved: number;
  budget: number | null;
  summary: string;
};

const EXAMPLES = [
  "Kitchen remodel under $300",
  "Home office setup, $200 budget",
  "Gifts under $50",
  "Workout gear for beginners",
];

export default function CartBuilderScreen() {
  const { colors, theme } = useTheme();
  const { isPremium } = useUser();
  const navigation = useNavigation<any>();
  const dark = theme === "dark";

  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CartResult | null>(null);

  const cardBg = dark ? "#141414" : "#fff";
  const textPrimary = dark ? "#fff" : "#111";
  const textSecondary = dark ? "#9e9e9e" : "#666";
  const accent = "#FF7A00";
  const green = "#2ecc71";

  const build = async (text?: string) => {
    const q = (text ?? request).trim();
    if (!q) return;
    if (!isPremium) { navigation.navigate("Upgrade"); return; }
    setLoading(true);
    setResult(null);
    if (text) setRequest(text);
    try {
      const call = httpsCallable(functions, "buildCart");
      const res: any = await call({ request: q });
      setResult(res.data as CartResult);
    } catch (e: any) {
      Alert.alert("Couldn't build cart", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openDeal = (item: CartItem) => {
    if (item.affiliateUrl) Linking.openURL(item.affiliateUrl);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 10 }}>
            <Ionicons name="chevron-back" size={26} color={textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: accent }]}>✨ AI Cart Builder</Text>
        </View>
        <Text style={{ color: textSecondary, marginBottom: 16 }}>
          Tell me what you need — I'll build the best cart from live deals.
        </Text>

        {/* Input */}
        <View style={[styles.inputWrap, { backgroundColor: cardBg, borderColor: accent + "55" }]}>
          <TextInput
            style={[styles.input, { color: textPrimary }]}
            placeholder='e.g. "Remodeling my kitchen, budget $300"'
            placeholderTextColor={textSecondary}
            value={request}
            onChangeText={setRequest}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.buildBtn, { backgroundColor: accent, opacity: loading || !request.trim() ? 0.5 : 1 }]}
            onPress={() => build()}
            disabled={loading || !request.trim()}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buildText}>🛒 Build My Cart</Text>}
          </TouchableOpacity>
        </View>

        {/* Example chips */}
        {!result && !loading && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {EXAMPLES.map((ex) => (
              <TouchableOpacity
                key={ex}
                style={[styles.chip, { backgroundColor: cardBg, borderColor: dark ? "#2a2a2a" : "#ddd" }]}
                onPress={() => build(ex)}
              >
                <Text style={{ color: textSecondary, fontSize: 13, fontWeight: "600" }}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <ActivityIndicator size="large" color={accent} />
            <Text style={{ color: textSecondary, marginTop: 12 }}>Scanning live deals and building your cart…</Text>
          </View>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: accent + "55" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ color: textPrimary, fontWeight: "900", fontSize: 18 }}>
                  {result.cart.length} item{result.cart.length !== 1 ? "s" : ""} • ${result.total.toFixed(2)}
                </Text>
                {result.totalSaved > 0 && (
                  <Text style={{ color: green, fontWeight: "900", fontSize: 16 }}>
                    Save ${result.totalSaved.toFixed(2)}
                  </Text>
                )}
              </View>
              {result.budget != null && (
                <Text style={{ color: textSecondary, fontSize: 13, marginBottom: 6 }}>
                  Budget ${result.budget} • ${Math.max(0, result.budget - result.total).toFixed(2)} left over
                </Text>
              )}
              {!!result.summary && (
                <Text style={{ color: textSecondary, fontSize: 14, lineHeight: 20 }}>{result.summary}</Text>
              )}
            </View>

            {result.cart.length === 0 && (
              <Text style={{ color: textSecondary, textAlign: "center", marginTop: 20 }}>
                No matching deals right now — try different wording.
              </Text>
            )}

            {result.cart.map((item) => (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: cardBg }]}>
                <View style={{ flexDirection: "row" }}>
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, { backgroundColor: dark ? "#222" : "#eee", justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="cube-outline" size={28} color={textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                      {item.store.toUpperCase()}
                    </Text>
                    <Text style={{ color: textPrimary, fontWeight: "800", fontSize: 15 }} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Text style={{ color: accent, fontWeight: "900", fontSize: 17 }}>${item.price.toFixed(2)}</Text>
                      {item.originalPrice > item.price && (
                        <Text style={{ color: textSecondary, textDecorationLine: "line-through", fontSize: 13 }}>
                          ${item.originalPrice.toFixed(2)}
                        </Text>
                      )}
                      {item.discountPercent > 0 && (
                        <Text style={{ color: green, fontWeight: "800", fontSize: 13 }}>-{item.discountPercent}%</Text>
                      )}
                    </View>
                  </View>
                </View>
                {!!item.reason && (
                  <Text style={{ color: textSecondary, fontSize: 13, marginTop: 8, fontStyle: "italic" }}>
                    💡 {item.reason}
                  </Text>
                )}
                <TouchableOpacity style={[styles.grabBtn, { backgroundColor: accent }]} onPress={() => openDeal(item)}>
                  <Text style={styles.grabText}>GRAB DEAL →</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.chip, { alignSelf: "center", marginTop: 16, backgroundColor: cardBg, borderColor: accent }]}
              onPress={() => { setResult(null); setRequest(""); }}
            >
              <Text style={{ color: accent, fontWeight: "800" }}>↺ Build another cart</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  title: { fontSize: 24, fontWeight: "900" },
  inputWrap: { borderRadius: 16, borderWidth: 1, padding: 12 },
  input: { minHeight: 60, fontSize: 16, textAlignVertical: "top" },
  buildBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 10 },
  buildText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 20 },
  itemCard: { borderRadius: 16, padding: 14, marginTop: 12 },
  itemImg: { width: 74, height: 74, borderRadius: 12 },
  grabBtn: { borderRadius: 10, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  grabText: { color: "#000", fontWeight: "900" },
});
