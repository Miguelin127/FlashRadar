import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { analyzeFlip } from "../services/analyzeFlip";
import FlipItResultScreen from "./FlipItResultScreen";

const PARSE_ENDPOINT =
  "https://us-central1-flashradar-71c93.cloudfunctions.net/parseProduct";

export default function FlipLinkScreen() {
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fetchProductData = async () => {
    if (!link.startsWith("http")) {
      Alert.alert("Invalid link", "Please paste a valid product URL");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(PARSE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });

      const data = await res.json();

      // ❌ Amazon / blocked / failed scrape → manual fallback
      if (!res.ok || data?.error) {
        Alert.alert(
          "Limited data",
          "We couldn’t auto-detect price. Enter it manually."
        );
        setTitle("");
        setBuyPrice("");
        return;
      }

      setTitle(data.title ?? "");
      setBuyPrice(data.price ? String(data.price) : "");
    } catch (err) {
      Alert.alert("Error", "Unable to fetch product data");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    const buy = Number(buyPrice);

    if (!title || !buy || Number.isNaN(buy)) {
      Alert.alert("Missing info", "Enter product name and buy price");
      return;
    }

    const flip = analyzeFlip({
      userId: "demo-user",
      title,
      buyPrice: buy,
      priceHistory: [
  { date: Date.now(), price: buy }
],

platformInputs: {
  amazon: {
    resalePrice: Math.round(buy * 1.4),
    buyPrice: buy,
    estimatedFees: Math.round(buy * 0.15),
    demand: "MEDIUM",
  },
},
      demand: "MEDIUM",
      dealOrigin: "MANUAL",
      source: "LINK",
    });

    setResult(flip);
  };

  if (result) {
    return <FlipItResultScreen flip={result} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Paste Product Link</Text>

      <TextInput
        value={link}
        onChangeText={setLink}
        placeholder="https://amazon.com/..."
        placeholderTextColor="#777"
        style={styles.input}
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.fetchBtn} onPress={fetchProductData}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.fetchText}>Fetch Product</Text>
        )}
      </TouchableOpacity>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Product name"
        placeholderTextColor="#777"
        style={styles.input}
      />

      <TextInput
        value={buyPrice}
        onChangeText={setBuyPrice}
        placeholder="Buy price"
        placeholderTextColor="#777"
        keyboardType="numeric"
        style={styles.input}
      />

      <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze}>
        <Text style={styles.analyzeText}>Analyze Flip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0e",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  fetchBtn: {
    backgroundColor: "#ffb000",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  fetchText: {
    fontWeight: "800",
    color: "#000",
  },
  analyzeBtn: {
    backgroundColor: "#ff7a00",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  analyzeText: {
    fontWeight: "800",
    color: "#000",
  },
});
