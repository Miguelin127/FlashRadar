// flashradar/screens/LoginScreen.tsx

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView, Image,
} from "react-native";
import SafeAreaWrapper from "../components/SafeAreaWrapper";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";

const ACCENT = "#FF7A00";
const ADMIN_EMAIL = "miguelx.x127@gmail.com";

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const navigation = useNavigation<any>();

  // After a successful sign-in, return the user to browsing.
  const dismiss = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("MainTabs");
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"login" | "signup" | "google" | "apple" | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const handleEmail = async () => {
    if (!email || !password) { Alert.alert("Missing info", "Enter email and password"); return; }
    try {
      setLoading(mode);
      if (mode === "login") await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
      dismiss();
    } catch (e: any) {
      Alert.alert(mode === "login" ? "Login failed" : "Signup failed", e.message);
    } finally { setLoading(null); }
  };

  const handleGoogle = async () => {
    try {
      setLoading("google");
      await signInWithGoogle();
      dismiss();
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e.message);
    } finally { setLoading(null); }
  };

  const handleApple = async () => {
    try {
      setLoading("apple");
      await signInWithApple();
      dismiss();
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple sign-in failed", e.message);
      }
    } finally { setLoading(null); }
  };

  return (
    <SafeAreaWrapper style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>FlashRadar</Text>
          <Text style={styles.subtitle}>Detect deals before everyone else</Text>

          {/* Google */}
          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} disabled={!!loading}>
            {loading === "google"
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="logo-google" size={20} color="#fff" />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
            }
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleBtn}
              onPress={handleApple}
            />
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / Password */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#888"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.btn} onPress={handleEmail} disabled={!!loading}>
            {loading === "login" || loading === "signup"
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnText}>{mode === "login" ? "Login" : "Sign Up"}</Text>
            }
          </TouchableOpacity>

          {/* Toggle login/signup */}
          <TouchableOpacity onPress={() => setMode(m => m === "login" ? "signup" : "login")}>
            <Text style={styles.toggleText}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={{ color: ACCENT, fontWeight: "800" }}>
                {mode === "login" ? "Sign Up" : "Login"}
              </Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  logoWrap: { marginBottom: 12 },
  logo: { width: 90, height: 90, borderRadius: 20 },
  title: { fontSize: 30, fontWeight: "900", color: "#fff", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#888", marginBottom: 28, textAlign: "center" },

  socialBtn: {
    width: "100%", height: 52, borderRadius: 12,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, marginBottom: 10,
  },
  socialBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  appleBtn: { width: "100%", height: 52, marginBottom: 10 },

  divider: { flexDirection: "row", alignItems: "center", width: "100%", marginVertical: 16, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#222" },
  dividerText: { color: "#555", fontSize: 12, fontWeight: "600" },

  input: {
    width: "100%", height: 52, borderWidth: 1, borderColor: "#222",
    borderRadius: 12, paddingHorizontal: 14, marginBottom: 10,
    color: "#fff", backgroundColor: "#0f0f0f", fontSize: 15,
  },
  btn: {
    width: "100%", height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    backgroundColor: ACCENT, marginTop: 4,
    shadowColor: ACCENT, shadowRadius: 12, shadowOpacity: 0.3, elevation: 6,
  },
  btnText: { fontSize: 16, fontWeight: "900", color: "#000" },
  toggleText: { color: "#888", fontSize: 13, marginTop: 16 },
});