import React, { useState, useEffect, useRef } from "react";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Animated, Easing, Linking,
} from "react-native";
import {
  CameraView, useCameraPermissions, BarcodeScanningResult,
} from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as Haptics from "expo-haptics";
import SafeAreaWrapper from "../components/SafeAreaWrapper";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { db } from "../firebaseConfig";
import { ScannedItem } from "../types/ScannedItem";

// ── Correct affiliate tag ──────────────────────────────────────────────────
// Previously "flashradar20e-20" (typo) — every scanner search was untracked.
const AMAZON_TAG = "flashradar20-20";

const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
  try { await Haptics.impactAsync(style); } catch {}
};

const buildAmazonSearchQuery = (product: ScannedItem): string => {
  const safeTitle = typeof product.title === "string" && product.title.trim().length > 4
    ? product.title.trim() : "";
  const safeBarcode = typeof product.barcode === "string" && product.barcode.length > 0
    ? product.barcode : "";
  if (safeTitle) return encodeURIComponent(safeTitle);
  if (safeBarcode) return encodeURIComponent(safeBarcode);
  return encodeURIComponent("product");
};

export default function FlipScannerScreen() {
  const navigation = useNavigation<any>();
  const { isPremium } = useUser();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState<ScannedItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 40, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ]).start(() => setToastMessage(null));
    }, 1800);
  };

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const saveScanToUser = async (item: ScannedItem) => {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // ── Compat SDK ──────────────────────────────────────────────────────────
    await db
      .collection("users")
      .doc(user.uid)
      .collection("scans")
      .add({
        ...item,
        uid: user.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      });
  };

  const checkScanLimit = async (uid: string): Promise<boolean> => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = db.collection("users").doc(uid).collection("usage").doc(`scans-${today}`);
      const snap = await ref.get();
      const count = snap.exists ? (snap.data()?.count ?? 0) : 0;
      if (count >= 3) return false;
      await ref.set({ count: count + 1, updatedAt: Date.now() }, { merge: true });
      return true;
    } catch { return true; }
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        showToast("Please log in");
        setScanned(false);
        setLoading(false);
        return;
      }

      const allowed = isPremium ? true : await checkScanLimit(user.uid);
      if (!allowed) {
        showToast("3 free scans used today — upgrade for unlimited");
        setScanned(false);
        setLoading(false);
        return;
      }

      let title = "Unknown Product";
      let image = "https://via.placeholder.com/300x300.png?text=No+Image";

      try {
        const res = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
        const p = res.data?.product;
        if (p?.product_name) title = p.product_name;
        if (p?.image_url) image = p.image_url;
      } catch {}

      const foundProduct: ScannedItem = {
        id: `${Date.now()}`,
        uid: user.uid,
        type: "barcode",
        barcode: data,
        title,
        image,
        source: "api",
        createdAt: Date.now(),
      };

      setProduct(foundProduct);
      await triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      Animated.timing(successAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    } catch (err) {
      console.error("❌ Scan error:", err);
      showToast("Scan failed");
      setScanned(false);
    }

    setLoading(false);
  };

  if (!permission) {
    return <SafeAreaWrapper style={styles.center}><ActivityIndicator size="large" color="#FF6600" /></SafeAreaWrapper>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <TouchableOpacity style={styles.scanAgain} onPress={requestPermission}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.scanText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper style={styles.container}>
      {!scanned && (
        <CameraView
          style={{ flex: 1, width: "100%" }}
          facing="back"
          flash={flash ? "on" : "off"}
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "upc_a", "upc_e", "code128"] }}
        />
      )}

      <TouchableOpacity
        style={[styles.flashButton, flash && styles.flashButtonActive]}
        onPress={() => setFlash((p) => !p)}
      >
        <Ionicons name={flash ? "flash" : "flash-off"} size={26} color="#fff" />
      </TouchableOpacity>

      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      <Animated.View style={[styles.successPopup, { opacity: successAnim }]}>
        <Ionicons name="checkmark-circle" size={56} color="#00FF7F" />
      </Animated.View>

      <View style={styles.overlay}>
        <Text style={styles.title}>📦 Scan a product barcode</Text>
        {loading && <ActivityIndicator size="large" color="#FF6600" />}
        {product && (
          <View style={styles.card}>
            <Image source={{ uri: product.image }} style={styles.image} />
            <Text style={styles.productTitle}>{product.title}</Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: "#00C853" }]}
              onPress={async () => {
                await saveScanToUser(product);
                navigation.navigate("FlipIt", { prefillTitle: product.title });
              }}
            >
              <Ionicons name="trending-up-outline" size={18} color="#000" />
              <Text style={styles.primaryText}>Analyze Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={async () => {
                await saveScanToUser(product);
                const q = buildAmazonSearchQuery(product);
                // ── Correct affiliate tag ────────────────────────────────────
                Linking.openURL(`https://www.amazon.com/s?k=${q}&tag=${AMAZON_TAG}`);
              }}
            >
              <Ionicons name="cart-outline" size={18} color="#000" />
              <Text style={styles.primaryText}>Search Prices</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanAgain}
              onPress={() => { setScanned(false); setProduct(null); successAnim.setValue(0); }}
            >
              <Ionicons name="scan-outline" size={20} color="#fff" />
              <Text style={styles.scanText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  flashButton: { position: "absolute", top: 70, right: 25, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 50, padding: 10, zIndex: 20 },
  flashButtonActive: { backgroundColor: "#FF6600" },
  toast: { position: "absolute", bottom: 100, alignSelf: "center", backgroundColor: "#FF6600", paddingVertical: 10, paddingHorizontal: 22, borderRadius: 20, zIndex: 30 },
  toastText: { color: "#fff", fontWeight: "700" },
  successPopup: { position: "absolute", top: "35%", alignSelf: "center", zIndex: 40 },
  overlay: { position: "absolute", bottom: 40, width: "90%", alignSelf: "center", backgroundColor: "rgba(20,20,20,0.9)", borderRadius: 20, padding: 16, alignItems: "center" },
  title: { color: "#FF6600", fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  card: { alignItems: "center", marginTop: 10 },
  image: { width: 160, height: 160, borderRadius: 12, marginBottom: 8 },
  productTitle: { color: "#fff", fontSize: 16, fontWeight: "bold", textAlign: "center" },
  primaryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF6600", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  primaryText: { color: "#000", fontWeight: "800", marginLeft: 6 },
  scanAgain: { flexDirection: "row", alignItems: "center", backgroundColor: "#333", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10 },
  scanText: { color: "#fff", fontWeight: "bold", marginLeft: 6 },
});