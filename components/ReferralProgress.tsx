// flashradar/components/ReferralProgress.tsx
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert } from "react-native";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../context/AuthContext";

export default function ReferralProgress() {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [rewardUnlocked, setRewardUnlocked] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setReferralCode(data.referralCode || null);
        setRewardUnlocked(data.rewardUnlocked || null);
      }
    });

    return () => unsub();
  }, [user]);

  const handleShare = async () => {
    try {
      const referralLink = referralCode
        ? `https://flashradarapp.web.app/referral?code=${referralCode}`
        : "https://flashradarapp.web.app/";

      const message = referralCode
        ? `🚀 Join me on FlashRadar! Unlock exclusive deals and rare finds.\nUse my referral code: ${referralCode}\n👉 ${referralLink}`
        : `🚀 Join me on FlashRadar! Find the hottest deals near you 🔥\n👉 ${referralLink}`;

      await Share.share({ message });
    } catch (error) {
      console.error("Share error:", error);
      Alert.alert("Error", "Could not open share menu.");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Referral Progress</Text>

      {referralCode ? (
        <>
          <Text style={styles.codeLabel}>Your Code:</Text>
          <Text style={styles.code}>{referralCode}</Text>

          {rewardUnlocked ? (
            <Text style={styles.rewardText}>🎁 Reward Unlocked: {rewardUnlocked}</Text>
          ) : (
            <Text style={styles.rewardText}>
              Refer friends to start unlocking exclusive rewards!
            </Text>
          )}

          <TouchableOpacity style={styles.button} onPress={handleShare}>
            <Text style={styles.buttonText}>Share Invite Link</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.loading}>Loading referral info…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    marginTop: 20,
    marginHorizontal: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FF6600",
    marginBottom: 10,
  },
  codeLabel: {
    fontSize: 14,
    color: "#555",
  },
  code: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginVertical: 5,
  },
  rewardText: {
    fontSize: 15,
    color: "#444",
    marginVertical: 10,
  },
  button: {
    backgroundColor: "#FF6600",
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  loading: {
    color: "#666",
    fontSize: 14,
  },
});
