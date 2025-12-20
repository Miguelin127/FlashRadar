// flashradar/App.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  NavigationContainer,
  NavigationContainerRef,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { ActivityIndicator, View, StyleSheet, Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc } from "firebase/firestore";

import RootNavigator from "./navigation/RootNavigator";
import LoginScreen from "./screens/LoginScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { db } from "./firebaseConfig";

/**
 * 🚨 IMPORTANT
 * Push notifications are TEMPORARILY DISABLED
 * to avoid the Hermes + podfile crash.
 * We will re-enable them cleanly later.
 */
// import { registerPushToken } from "./utils/registerPushToken";

// ─────────────────────────── MAIN APP WRAPPER ───────────────────────────
export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any> | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <SafeAreaProvider>
            <MainApp navigationRef={navigationRef} />
          </SafeAreaProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────── CORE APP ───────────────────────────
function MainApp({
  navigationRef,
}: {
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
}) {
  const { user, ready } = useAuth();
  const { theme, colors } = useTheme();
  const [navReady, setNavReady] = useState(false);

  /**
   * 🔕 Push registration intentionally disabled
   * useEffect(() => {
   *   if (user?.uid) {
   *     registerPushToken(user.uid);
   *   }
   * }, [user]);
   */

  const appTheme = {
    ...(theme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...((theme === "dark" ? DarkTheme : DefaultTheme).colors),
      background: colors.background,
      text: colors.text,
      primary: colors.accent,
      card: colors.card,
      border: "transparent",
    },
  };

  // ───────── Stripe / Deep Links ─────────
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log("🔗 Deep link:", url);

      if (url.includes("flashradar://success") || url.includes("flashradar://cancel")) {
        return;
      }

      if (url.includes("settings")) {
        const parsed = Linking.parse(url);
        const status = parsed.queryParams?.status;

        if (status === "success") {
          Alert.alert("✅ Premium Unlocked", "Welcome to FlashRadar Premium 🎉");

          if (user?.uid) {
            await updateDoc(doc(db, "users", user.uid), {
              isPremium: true,
            });
          }
        }

        setTimeout(() => {
          const nav = navigationRef.current;
          if (nav && navReady) {
            (nav as any).navigate("MainTabs", {
              screen: "Settings",
            });
          }
        }, 500);
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => url && handleDeepLink({ url }));

    return () => sub.remove();
  }, [user, navReady]);

  // ───────── Referral Links ─────────
  useEffect(() => {
    const handleReferral = async (url: string) => {
      if (!url.includes("?code=")) return;

      const parsed = Linking.parse(url);
      let code = parsed.queryParams?.code;

      if (Array.isArray(code)) code = code[0];
      if (typeof code !== "string") return;

      await AsyncStorage.setItem("pendingReferral", code);
      console.log("🎯 Referral stored:", code);
    };

    Linking.getInitialURL().then((url) => url && handleReferral(url));
    const sub = Linking.addEventListener("url", (e) => handleReferral(e.url));

    return () => sub.remove();
  }, []);

  // ───────── Boot Loader ─────────
  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        style={theme === "dark" ? "light" : "dark"}
        backgroundColor={colors.background}
      />

      <NavigationContainer
        ref={navigationRef as any}
        onReady={() => setNavReady(true)}
        theme={appTheme}
      >
        {user ? <RootNavigator /> : <LoginScreen />}
      </NavigationContainer>
    </>
  );
}

// ─────────────────────────── STYLES ───────────────────────────
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
