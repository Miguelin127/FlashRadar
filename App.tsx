// flashradar/App.tsx
import * as Notifications from 'expo-notifications';
import { Platform } from "react-native";
import * as Location from "expo-location";
import Purchases from 'react-native-purchases';
import firebase from "firebase/compat/app";

import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { UserProvider } from "./context/UserContext";
import RootNavigator from "./navigation/RootNavigator";
import UpdatePrompt from "./components/UpdatePrompt";
import { auth, db } from "./firebaseConfig";
import { registerForPushToken } from "./utils";
import { navigationRef, openDealById } from "./utils/navigationRef";

async function captureAndSaveLocation(uid: string) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const loc = await Location.getCurrentPositionAsync({});
    await db.collection("users").doc(uid).set({
      location: {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      },
      locationUpdatedAt: new Date(),
    }, { merge: true });
    console.log("[Location] Saved to Firestore");
  } catch (e) {
    console.warn("[Location] Failed:", e);
  }
}

function AppWithTheme() {

async function saveFCMToken(uid: string) {
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await db.collection("users").doc(uid).set({
      fcmToken: token,
      notificationPreferences: {},
      fcmTokenUpdatedAt: new Date(),
    }, { merge: true });
    console.log("[Push] FCM token saved");
  } catch (e) {
    console.warn("[Push] Failed to save token:", e);
  }
}
  const { darkMode } = useTheme();
  return (
    <NavigationContainer ref={navigationRef} theme={darkMode ? DarkTheme : DefaultTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (!__DEV__) {
  try {
    Purchases.configure({ apiKey: Platform.OS === "android" ? "goog_iquOFwaWGHIwFIqLWOsQzibmABE" : "appl_UziJXOhRXKINbzrFMAQWFBcPziu" });
  } catch (e) {
    console.log("[RevenueCat] Config failed:", e);
  }
} else {
  console.log("[RevenueCat] Skipping in dev mode");
}

export default function App() {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        firebase.firestore().clearPersistence().catch(() => {});
      } catch {}
    }, 500);

    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        captureAndSaveLocation(user.uid);
        // Registering only behind the Settings toggle left 1 of 22
        // users with a push token, so no notification feature could
        // reach anyone. Ask once on sign-in instead.
        registerForPushToken().catch(() => {});
        // Identify user to RevenueCat so billing events carry the Firebase UID
        try { await Purchases.logIn(user.uid); } catch {}
      } else {
        try { await Purchases.logOut(); } catch {}
      }
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);

  // A notification tap should land on the item, not just open the app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data: any = response?.notification?.request?.content?.data ?? {};
      if (data?.dealId) openDealById(String(data.dealId));
    });

    // A tap that launched the app from cold is not delivered to the
    // listener above, only to this.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        const data: any = response?.notification?.request?.content?.data ?? {};
        if (data?.dealId) openDealById(String(data.dealId));
      })
      .catch(() => {});

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <UserProvider>
              <AppWithTheme />
              <UpdatePrompt />
            </UserProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}