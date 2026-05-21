// flashradar/screens/SignUpScreen.tsx

import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import SafeAreaWrapper from "../components/SafeAreaWrapper";
import { auth, db } from "../firebaseConfig";
import firebase from "firebase/compat/app";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralInput, setReferralInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      // ── Compat SDK — matches auth instance from firebaseConfig.ts ────────
      // Previously used modular getAuth/createUserWithEmailAndPassword which
      // creates a second Firebase Auth instance, conflicting with compat auth.
      const userCred = await auth.createUserWithEmailAndPassword(
        email.trim(),
        password
      );
      const user = userCred.user;
      if (!user) return;

      // ── Save user doc ─────────────────────────────────────────────────────
      await db.collection("users").doc(user.uid).set({
        email: user.email,
        referralCode: user.uid.slice(0, 8).toUpperCase(),
        referredBy: referralInput.trim() || null,
        isPremium: false,
        subscriptionStatus: "none",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      Alert.alert("Success", "Account created successfully!");
    } catch (e: any) {
      console.error("SignUp error:", e);
      Alert.alert("Signup Error", e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.header}>Create Account</Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          secureTextEntry
        />

        <TextInput
          placeholder="Referral Code (optional)"
          value={referralInput}
          onChangeText={setReferralInput}
          style={styles.input}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff", justifyContent: "center" },
  container: { padding: 20 },
  header: { fontSize: 24, fontWeight: "700", marginBottom: 20, textAlign: "center", color: "#FF6600" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  button: { backgroundColor: "#FF6600", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});