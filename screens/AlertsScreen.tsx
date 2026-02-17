import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

export default function AlertsScreen() {
  const userId = "demo-user"; // replace with auth user
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const ref = collection(db, "users", userId, "alerts");
    const unsub = onSnapshot(ref, snap => {
      setAlerts(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });
    return unsub;
  }, []);

  const markRead = async (alertId: string) => {
    await updateDoc(
      doc(db, "users", userId, "alerts", alertId),
      { read: true }
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.read && styles.read]}
            onPress={() => markRead(item.id)}
          >
            <Text style={styles.title}>{item.message}</Text>
            <Text style={styles.sub}>
              {item.type === "FLIP_READY" ? "🔥 Flip Ready" : ""}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0e",
    padding: 16,
  },
  card: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    marginBottom: 10,
  },
  read: {
    opacity: 0.5,
  },
  title: {
    color: "#fff",
    fontWeight: "700",
  },
  sub: {
    color: "#aaa",
    marginTop: 4,
    fontSize: 12,
  },
});
