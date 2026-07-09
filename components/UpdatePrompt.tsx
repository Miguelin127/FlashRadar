// flashradar/components/UpdatePrompt.tsx
//
// Firestore config doc: config/appVersion
// {
//   latestVersion: "1.1.0",   // newest available in stores
//   minVersion:    "1.0.0",   // below this = forced update (hard gate)
//   iosUrl:  "https://apps.apple.com/app/id6755168361",
//   androidUrl: "https://play.google.com/store/apps/details?id=com.miguelin1.flashradarapp",
//   message: "A new version of FlashRadar is available."  // optional
// }

import React, { useEffect, useState } from "react";
import { View, Text, Modal, Pressable, Linking, Platform, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { db } from "../firebaseConfig";

const IOS_STORE_FALLBACK = "https://apps.apple.com/app/id6755168361";
const ANDROID_STORE_FALLBACK =
  "https://play.google.com/store/apps/details?id=com.miguelin1.flashradarapp";

// Compare semver-ish strings: returns -1, 0, 1
function cmpVersion(a: string, b: string): number {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function currentVersion(): string {
  // expo-constants surfaces the version from app.json
  return (
    (Constants.expoConfig?.version as string) ||
    (Constants as any).manifest?.version ||
    "0.0.0"
  );
}

export default function UpdatePrompt() {
  const [mode, setMode] = useState<"none" | "soft" | "hard">("none");
  const [storeUrl, setStoreUrl] = useState("");
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = db
      .collection("config")
      .doc("appVersion")
      .onSnapshot(
        (snap) => {
          const cfg = snap.data();
          if (!cfg) { setMode("none"); return; }

          const cur = currentVersion();
          const latest = cfg.latestVersion ?? cur;
          const min = cfg.minVersion ?? "0.0.0";

          const url = Platform.OS === "ios"
            ? (cfg.iosUrl || IOS_STORE_FALLBACK)
            : (cfg.androidUrl || ANDROID_STORE_FALLBACK);
          setStoreUrl(url);
          setMessage(cfg.message || "A new version of FlashRadar is available.");

          if (cmpVersion(cur, min) < 0) {
            setMode("hard");          // below minimum → force
          } else if (cmpVersion(cur, latest) < 0) {
            setMode("soft");          // behind latest → nudge
          } else {
            setMode("none");          // up to date
          }
        },
        () => setMode("none")
      );
    return () => unsub();
  }, []);

  const openStore = () => { if (storeUrl) Linking.openURL(storeUrl); };

  if (mode === "none") return null;
  if (mode === "soft" && dismissed) return null;

  const forced = mode === "hard";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { if (!forced) setDismissed(true); }}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🚀</Text>
          <Text style={styles.title}>{forced ? "Update Required" : "Update Available"}</Text>
          <Text style={styles.body}>
            {forced
              ? "This version is no longer supported. Please update to keep using FlashRadar."
              : message}
          </Text>

          <Pressable style={styles.primaryBtn} onPress={openStore}>
            <Text style={styles.primaryText}>Update Now</Text>
          </Pressable>

          {!forced && (
            <Pressable onPress={() => setDismissed(true)}>
              <Text style={styles.later}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { backgroundColor: "#141414", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,122,0,0.4)" },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 8 },
  body: { color: "#bbb", fontSize: 15, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  primaryBtn: { backgroundColor: "#FF7A00", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  later: { color: "#888", fontWeight: "700", marginTop: 14, paddingVertical: 6 },
});
