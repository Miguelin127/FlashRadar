// flashradar/navigation/RootNavigator.tsx

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

import BottomTabsNavigator from "./BottomTabsNavigator";
import DealDetailScreen from "../screens/DealDetailScreen";
import FlipScannerScreen from "../screens/FlipScannerScreen";
import FlipHistoryScreen from "../screens/FlipHistoryScreen";
import FlipItResultScreen from "../screens/FlipItResultScreen";
import PremiumIntroScreen from "../screens/PremiumIntroScreen";
import ReferralScreen from "../screens/ReferralScreen";
import LoginScreen from "../screens/LoginScreen";
import MyFlipsScreen from "../screens/MyFlipsScreen";

import type { RootTabParamList } from "./BottomTabsNavigator";

// ─────────────────────────── TYPES ───────────────────────────
export type RootStackParamList = {
  // Auth
  Login: undefined;

  // Main
  MainTabs?: { screen?: keyof RootTabParamList };
  DealDetail?: { deal: any };

  // Flip flow
  FlipScanner: undefined;
  FlipHistory: undefined;
  FlipItResult: { flip: any };

  // My Flips (STACK ONLY)
  MyFlips: undefined;

  // Premium / Referral
  PremiumIntro: undefined;
  Referral: undefined;
};

// ─────────────────────────── STACK ───────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, ready } = useAuth();

  if (!ready) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          {/* Main App */}
          <Stack.Screen name="MainTabs" component={BottomTabsNavigator} />
          <Stack.Screen name="DealDetail" component={DealDetailScreen} />

          {/* Flip Flow */}
          <Stack.Screen name="FlipScanner" component={FlipScannerScreen} />
          <Stack.Screen name="FlipHistory" component={FlipHistoryScreen} />
          <Stack.Screen name="FlipItResult" component={FlipItResultScreen} />

          {/* My Flips (NOT A TAB) */}
          <Stack.Screen name="MyFlips" component={MyFlipsScreen} />
          

          {/* Premium / Referral */}
          <Stack.Screen name="PremiumIntro" component={PremiumIntroScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
