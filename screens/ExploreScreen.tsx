// flashradar/screens/ExploreScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import DealCard from "../components/DealCard";
import { useTheme } from "../context/ThemeContext";

type Deal = {
  id: string;
  title: string;
  store: string;
  price: number;
  image?: string;
  url?: string;
  timestamp?: any;
};

const FREE_STORES = ["Walmart", "Target", "Home Depot"];

export default function ExploreScreen() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const { theme, colors } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const q = query(
      collection(db, "deals_online"),
      where("store", "in", FREE_STORES),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data.title ?? "Deal",
            store: data.store ?? "Online",
            price: Number(data.price ?? 0),
            image: data.image ?? undefined,
            url: data.url ?? data.link ?? "",
            timestamp: data.timestamp,
          };
        });

        setDeals(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  const openDeal = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>
        Free Stores ({deals.length})
      </Text>

      <FlatList
        data={deals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.cardWrapper,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#fff",
                borderColor: isDark ? "#333" : "#ddd",
              },
            ]}
          >
            <DealCard
              deal={{
                id: item.id,
                title: item.title,
                store: item.store,
                price: item.price,
                image: item.image,
              }}
              onPress={() => openDeal(item.url)}
              darkMode={isDark}
              showOpenDealButton={false} // ✅ prevent duplicate button (Explore already has one below)
            />

            <TouchableOpacity style={styles.openBtn} onPress={() => openDeal(item.url)}>
              <Text style={styles.openText}>Open Deal</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.text }]}>No deals found.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    fontSize: 22,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  cardWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
  },

  openBtn: {
    marginTop: 8,
    backgroundColor: "#FF6600",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  openText: {
    color: "#fff",
    fontWeight: "800",
  },

  empty: {
    textAlign: "center",
    marginTop: 30,
    fontSize: 16,
  },
});
