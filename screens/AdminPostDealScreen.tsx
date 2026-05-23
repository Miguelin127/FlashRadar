import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import firebase from "firebase/compat/app";
import { db } from "../firebaseConfig";
import { useAuth } from "../context/AuthContext";

const ACCENT = "#FF7A00";
const STORES = ["Amazon", "Walmart", "Target", "BestBuy", "Costco", "HomeDepot", "Nike", "eBay", "Sephora", "Other"];

export default function AdminPostDealScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  const [title, setTitle] = useState("");
  const [store, setStore] = useState("Amazon");
  const [price, setPrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="lock-closed-outline" size={40} color="#444" />
        <Text style={{ color: "#555", marginTop: 12 }}>Admin only</Text>
      </SafeAreaView>
    );
  }

  const storeKey = store.toLowerCase().replace(/\s/g, "");
  const discountPercent = (() => {
    const p = parseFloat(price);
    const o = parseFloat(originalPrice);
    if (p > 0 && o > p) return Math.round(((o - p) / o) * 100);
    return null;
  })();

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert("Missing title"); return; }
    if (!price || isNaN(parseFloat(price))) { Alert.alert("Invalid price"); return; }
    if (!url.trim()) { Alert.alert("Missing URL"); return; }
    try {
      setLoading(true);
      const dealId = "MANUAL_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7).toUpperCase();
      await db.collection("deals_online_raw").doc(dealId).set({
        id: dealId,
        title: title.trim(),
        store,
        storeKey,
        price: parseFloat(price),
        originalPrice: originalPrice ? parseFloat(originalPrice) : null,
        discountPercent,
        url: url.trim(),
        affiliateUrl: url.trim(),
        merchantUrl: url.trim(),
        imageUrl: imageUrl.trim() || null,
        image: imageUrl.trim() || null,
        couponCode: couponCode.trim() || null,
        source: "manual-entry",
        live: true,
        isActive: true,
        hot: (discountPercent ?? 0) >= 30,
        rare: (discountPercent ?? 0) >= 50,
        postedBy: user?.email ?? "admin",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert("Deal Posted!", title + " is live.", [
        { text: "Post Another", onPress: () => { setTitle(""); setPrice(""); setOriginalPrice(""); setUrl(""); setImageUrl(""); setCouponCode(""); } },
        { text: "Done", onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Post a Deal</Text>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={ACCENT} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          </View>

          {title.length > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewStore}>{store.toUpperCase()}</Text>
              <Text style={styles.previewTitle} numberOfLines={2}>{title}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.previewPrice}>{price ? "$" + parseFloat(price).toFixed(2) : "$-"}</Text>
                {discountPercent && (
                  <View style={styles.discBadge}>
                    <Text style={styles.discBadgeText}>-{discountPercent}%</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Text style={styles.label}>Store</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {STORES.map((s) => (
              <TouchableOpacity key={s} onPress={() => setStore(s)}
                style={[styles.storeChip, store === s && { backgroundColor: ACCENT }]}>
                <Text style={[styles.storeChipText, store === s && { color: "#000" }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} placeholder="Deal title..." placeholderTextColor="#555"
            value={title} onChangeText={setTitle} multiline />

          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Price *</Text>
              <TextInput style={styles.input} placeholder="$0.00" placeholderTextColor="#555"
                value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Original Price</Text>
              <TextInput style={styles.input} placeholder="$0.00" placeholderTextColor="#555"
                value={originalPrice} onChangeText={setOriginalPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={styles.label}>Deal URL *</Text>
          <TextInput style={styles.input} placeholder="https://..." placeholderTextColor="#555"
            value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />

          <Text style={styles.label}>Image URL</Text>
          <TextInput style={styles.input} placeholder="https://... (optional)" placeholderTextColor="#555"
            value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" keyboardType="url" />

          <Text style={styles.label}>Coupon Code</Text>
          <TextInput style={styles.input} placeholder="SAVE20 (optional)" placeholderTextColor="#555"
            value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" />

          {discountPercent && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: "rgba(34,197,94,0.08)", padding: 10, borderRadius: 8, marginBottom: 16 }}>
              <Ionicons name="trending-down-outline" size={14} color="#22c55e" />
              <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "700" }}>
                {discountPercent}% off
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <><Ionicons name="flash" size={18} color="#000" /><Text style={styles.submitText}>POST TO FEED</Text></>
            }
          </TouchableOpacity>
          <Text style={{ color: "#444", fontSize: 11, textAlign: "center" }}>
            Manual deals bypass all filters and go live immediately.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  scroll: { padding: 16, paddingBottom: 60 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: ACCENT + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  adminBadgeText: { color: ACCENT, fontSize: 9, fontWeight: "900" },
  preview: { backgroundColor: "#0f0f0f", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: ACCENT + "33", marginBottom: 20 },
  previewStore: { color: "#888", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  previewTitle: { color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 8 },
  previewPrice: { color: ACCENT, fontSize: 22, fontWeight: "900" },
  discBadge: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discBadgeText: { color: "#22c55e", fontSize: 10, fontWeight: "900" },
  storeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "#1a1a1a", marginRight: 8, borderWidth: 1, borderColor: "#333" },
  storeChipText: { color: "#aaa", fontSize: 12, fontWeight: "700" },
  label: { color: "#888", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: "#0f0f0f", borderRadius: 10, borderWidth: 1, borderColor: "#222",
    paddingHorizontal: 14, paddingVertical: 12, color: "#fff", fontSize: 14, marginBottom: 14 },
  submitBtn: { backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: ACCENT, shadowRadius: 16, shadowOpacity: 0.4, elevation: 8, marginBottom: 12 },
  submitText: { color: "#000", fontWeight: "900", fontSize: 16 },
});
