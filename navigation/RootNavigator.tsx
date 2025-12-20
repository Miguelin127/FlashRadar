// flashradar/navigation/RootNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BottomTabsNavigator from "./BottomTabsNavigator"; // ✅ unified tabs
import DealDetailScreen from "../screens/DealDetailScreen";
import FlipScannerScreen from "../screens/FlipScannerScreen";
import FlipHistoryScreen from "../screens/FlipHistoryScreen";
import PremiumIntroScreen from "../screens/PremiumIntroScreen";
import ReferralScreen from "../screens/ReferralScreen";
import type { RootTabParamList } from "./BottomTabsNavigator"; // ✅ import for typed tab names

// ─────────────────────────── TYPES ───────────────────────────
export type RootStackParamList = {
  MainTabs?: { screen?: keyof RootTabParamList }; // ✅ supports nested tab navigation
  DealDetail?: { deal: any };
  FlipScanner: undefined;
  FlipHistory: undefined;
  PremiumIntro: undefined;
  Referral: undefined;
};

// ─────────────────────────── STACK NAVIGATOR ───────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* 👇 Unified Bottom Tabs */}
      <Stack.Screen name="MainTabs" component={BottomTabsNavigator} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} />
      <Stack.Screen name="FlipScanner" component={FlipScannerScreen} />
      <Stack.Screen name="FlipHistory" component={FlipHistoryScreen} />
      <Stack.Screen name="PremiumIntro" component={PremiumIntroScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      {/* ⚡️ CreatorDashboard removed to prevent duplicate stacking */}
    </Stack.Navigator>
  );
}
