// flashradar/App.tsx
import * as Notifications from 'expo-notifications';
import * as Location from "expo-location";
import Purchases from 'react-native-purchases';
import firebase from "firebase/compat/app";
import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";

import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { UserProvider } from "./context/UserContext";
import RootNavigator from "./navigation/RootNavigator";
import { auth, db } from "./firebaseConfig";

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
  const { darkMode } = useTheme();
  return (
    <NavigationContainer theme={darkMode ? DarkTheme : DefaultTheme}>
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

try {
  Purchases.configure({ apiKey: 'appl_UziJXOhRXKINbzrFMAQWFBcPziu' });
} catch (e) {
  console.log("[RevenueCat] Skipping in simulator/Expo Go");
}

export default function App() {
  useEffect(() => {
    // ATT request — must happen early
    requestTrackingPermissionsAsync().then(({ status }) => {
      console.log("[ATT] Tracking status:", status);
    });

    // Clear Firestore cache on start
    try {
      firebase.firestore().clearPersistence().catch(() => {});
    } catch {}

    const unsub = auth.onAuthStateChanged((user) => {
      if (user) captureAndSaveLocation(user.uid);
    });
    return unsub;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <UserProvider>
            <AppWithTheme />
          </UserProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}