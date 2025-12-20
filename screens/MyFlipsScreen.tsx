// flashradar/screens/MyFlipsScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import SafeAreaWrapper from "../components/SafeAreaWrapper";

export default function MyFlipsScreen() {
  const { user } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "scans");
    const q = query(ref, orderBy("timestamp", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      setScans(items);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (!user) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <Ionicons name="lock-closed-outline" size={40} color="#FF6600" />
        <Text style={styles.lockText}>
          Please log in to view your Flip history.
        </Text>
      </SafeAreaWrapper>
    );
  }

  if (loading) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <ActivityIndicator size="large" color="#FF6600" />
        <Text style={styles.loadingText}>Loading your flips...</Text>
      </SafeAreaWrapper>
    );
  }

  if (scans.length === 0) {
    return (
      <SafeAreaWrapper style={styles.center}>
        <Ionicons name="cube-outline" size={40} color="#FF6600" />
        <Text style={styles.emptyText}>No flips yet. Start scanning!</Text>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper style={styles.container}>
      <Text style={styles.header}>📊 My Flips</Text>

      <FlatList
        data={scans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image
              source={{ uri: item.image }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.details}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.barcode}>Barcode: {item.barcode}</Text>
              <Text style={styles.price}>
                Retail: {item.retailPrice} → Resale: {item.resaleValue}
              </Text>
              <Text style={styles.profit}>{item.profit}</Text>
              <Text style={styles.time}>
                {item.timestamp?.toDate
                  ? item.timestamp.toDate().toLocaleString()
                  : "—"}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 12 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  header: {
    color: "#FF6600",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 12,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "rgba(25,25,25,0.9)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
  },
  details: { flex: 1 },
  title: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  barcode: { color: "#aaa", fontSize: 13 },
  price: { color: "#ccc", fontSize: 13, marginTop: 2 },
  profit: {
    color: "#00FF7F",
    fontWeight: "600",
    marginTop: 2,
  },
  time: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  lockText: { color: "#fff", marginTop: 10, fontSize: 16 },
  emptyText: { color: "#ccc", marginTop: 10, fontSize: 16 },
  loadingText: { color: "#ccc", marginTop: 10, fontSize: 16 },
});
