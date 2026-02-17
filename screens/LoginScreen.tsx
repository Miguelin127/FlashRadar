// flashradar/screens/LoginScreen.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import SafeAreaWrapper from "../components/SafeAreaWrapper";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"login" | "signup" | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }

    try {
      setLoading("login");
      await signIn(email.trim(), password);
      // ✅ DO NOT navigate manually
      // RootNavigator auto-switches when user is set
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    } finally {
      setLoading(null);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Enter email and password");
      return;
    }

    try {
      setLoading("signup");
      await signUp(email.trim(), password);
    } catch (e: any) {
      Alert.alert("Signup failed", e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaWrapper style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrapper}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>FlashRadar</Text>
          <Text style={styles.subtitle}>Login or Sign Up with Email</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={styles.btn}
            onPress={handleLogin}
            disabled={loading === "login"}
          >
            {loading === "login" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.signupBtn]}
            onPress={handleSignUp}
            disabled={loading === "signup"}
          >
            {loading === "signup" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign Up</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoWrapper: {
    marginBottom: 12,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 4,
    color: "#FF6600",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 18,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  btn: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FF6600",
    marginTop: 8,
  },
  signupBtn: {
    backgroundColor: "#333",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
