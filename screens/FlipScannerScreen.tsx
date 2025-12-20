// flashradar/screens/FlipScannerScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Animated,
  Easing,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import * as Haptics from "expo-haptics";
import SafeAreaWrapper from "../components/SafeAreaWrapper";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";

// ✅ Safe Haptic wrapper
const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
  try {
    if (typeof Haptics.impactAsync === "function") {
      await Haptics.impactAsync(style);
    }
  } catch (err) {
    console.log("⚠️ Haptics failed gracefully:", err);
  }
};

export default function FlipScannerScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 40,
          duration: 400,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    }, 2000);
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // ✅ Save scan to Firestore under user
  const saveScanToUser = async (data: any) => {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
      const ref = collection(db, "users", user.uid, "scans");
      await addDoc(ref, {
        ...data,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("❌ Error saving scan:", err);
    }
  };

  // 🎯 Handle barcode scan
  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    setScanned(true);
    setLoading(true);

    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        showToast("⚠️ Please log in first");
        return;
      }

      const productsRef = collection(db, "users", user.uid, "scans");
      const q = query(productsRef, where("barcode", "==", data));
      const querySnapshot = await getDocs(q);

      let foundProduct: any = null;

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0].data();
        foundProduct = {
          barcode: data,
          title: doc.title || "Untitled Product",
          image:
            doc.image ||
            "https://via.placeholder.com/150x150.png?text=No+Image",
          retailPrice: doc.retailPrice || "N/A",
          resaleValue: doc.resaleValue || "N/A",
          profit: doc.profit || "—",
        };
        showToast("✅ Product found in your history");
      } else {
        const response = await axios.get(
          `https://world.openfoodfacts.org/api/v0/product/${data}.json`
        );

        if (response.data && response.data.product) {
          const p = response.data.product;
          foundProduct = {
            barcode: data,
            title: p.product_name || "Unknown Product",
            image:
              p.image_url ||
              "https://via.placeholder.com/150x150.png?text=No+Image",
            retailPrice: p.stores_tags?.[0] || "N/A",
            resaleValue: "—",
            profit: "—",
          };
          showToast("🔍 Product found via API");
        } else {
          foundProduct = {
            barcode: data,
            title: "Product not found",
            image: "https://via.placeholder.com/150x150.png?text=No+Match",
            retailPrice: "N/A",
            resaleValue: "N/A",
            profit: "—",
          };
          showToast("⚠️ No match found");
        }

        await saveScanToUser(foundProduct);
      }

      setProduct(foundProduct);
      await triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      // ✅ Success animation then navigate
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(successAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }).start(() => {
            navigation.navigate("MainTabs", {
              screen: "FlipIt",
              params: { scannedValue: foundProduct.title },
            });
          });
        }, 1500);
      });
    } catch (error) {
      console.error("❌ Lookup error:", error);
      showToast("❌ Error fetching data");
      await triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setLoading(false);
  };

  if (!permission) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
        <Text style={{ color: "#fff", marginTop: 10 }}>
          Checking camera permission…
        </Text>
      </SafeAreaWrapper>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <Text style={{ color: "#fff", marginBottom: 10 }}>
          No access to camera
        </Text>
        <TouchableOpacity style={styles.scanAgain} onPress={requestPermission}>
          <Ionicons name="camera-outline" size={20} color="#fff" />
          <Text style={styles.scanText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper style={styles.container}>
      {!scanned && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          flash={flash ? "on" : "off"}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"],
          }}
        />
      )}

      {/* Flash toggle */}
      <TouchableOpacity
        style={[styles.flashButton, flash && styles.flashButtonActive]}
        onPress={() => setFlash((prev) => !prev)}
      >
        <Ionicons name={flash ? "flash" : "flash-off"} size={26} color="#fff" />
      </TouchableOpacity>

      {/* Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toast,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Success popup */}
      <Animated.View
        style={[
          styles.successPopup,
          {
            opacity: successAnim,
            transform: [
              {
                translateY: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [60, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={52} color="#00FF7F" />
      </Animated.View>

      {/* Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.title}>📦 Scan a product barcode</Text>

        {loading && <ActivityIndicator size="large" color="#FF6600" />}

        {product && (
          <View style={styles.card}>
            <Image source={{ uri: product.image }} style={styles.image} />
            <Text style={styles.productTitle}>{product.title}</Text>
            <Text style={styles.detail}>Retail: {product.retailPrice}</Text>
            <Text style={styles.detail}>Resale: {product.resaleValue}</Text>
            <Text style={styles.profit}>{product.profit}</Text>

            <TouchableOpacity
              style={styles.scanAgain}
              onPress={() => {
                setScanned(false);
                setProduct(null);
              }}
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  flashButton: {
    position: "absolute",
    top: 70,
    right: 25,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 50,
    padding: 10,
    zIndex: 20,
  },
  flashButtonActive: {
    backgroundColor: "#FF6600",
    shadowColor: "#FF6600",
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  toast: {
    position: "absolute",
    bottom: 90,
    alignSelf: "center",
    backgroundColor: "#FF6600",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    zIndex: 30,
  },
  toastText: { color: "#fff", fontWeight: "700" },
  successPopup: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    padding: 24,
    borderRadius: 20,
    zIndex: 40,
  },
  overlay: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    width: "90%",
    backgroundColor: "rgba(20,20,20,0.85)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
  },
  title: {
    color: "#FF6600",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  card: { alignItems: "center", marginTop: 10 },
  image: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 8,
  },
  productTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  detail: { color: "#ccc", fontSize: 14 },
  profit: {
    color: "#00FF7F",
    fontSize: 16,
    fontWeight: "600",
    marginVertical: 6,
  },
  scanAgain: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6600",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
  },
  scanText: { color: "#fff", fontWeight: "bold", marginLeft: 6 },
});
