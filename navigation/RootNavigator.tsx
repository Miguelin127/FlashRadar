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
import UpgradeScreen from "../screens/UpgradeScreen";
import AdminPostDealScreen from "../screens/AdminPostDealScreen";

import type { RootTabParamList } from "./BottomTabsNavigator";

/* ─── Types ──────────────────────────────────────────────────── */

export type RootStackParamList = {
  Login: undefined;
  MainTabs?: { screen?: keyof RootTabParamList };
  DealDetail: { deal: any };
  FlipScanner: undefined;
  FlipHistory: undefined;
  FlipItResult: { flip: any };
  MyFlips: undefined;
  PremiumIntro: undefined;
  Referral: undefined;
  Upgrade: undefined;
  CreatorDashboard: undefined;
  AdminPostDeal: undefined;
};

/* ─── Navigator ──────────────────────────────────────────────── */

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, ready } = useAuth();

  if (!ready) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          <Stack.Screen name="MainTabs" component={BottomTabsNavigator} />
          <Stack.Screen name="DealDetail" component={DealDetailScreen as any} />
          <Stack.Screen name="FlipScanner" component={FlipScannerScreen} />
          <Stack.Screen name="FlipHistory" component={FlipHistoryScreen} />
          <Stack.Screen name="FlipItResult" component={FlipItResultScreen as any} />
          <Stack.Screen name="MyFlips" component={MyFlipsScreen} />
          <Stack.Screen name="PremiumIntro" component={PremiumIntroScreen} />
          <Stack.Screen name="Referral" component={ReferralScreen} />
          <Stack.Screen name="Upgrade" component={UpgradeScreen} />
          <Stack.Screen name="AdminPostDeal" component={AdminPostDealScreen} />
          <Stack.Screen name="CreatorDashboard" component={
            require("../screens/CreatorDashboard").default
          } />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}