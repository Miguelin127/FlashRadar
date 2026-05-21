// flashradar/navigation/BottomTabsNavigator.tsx

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";

import RadarScreen from "../screens/RadarScreen";
import ExploreScreen from "../screens/ExploreScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import MapScreen from "../screens/MapScreen";
import FlipItScreen from "../screens/FlipItScreen";
import CreatorDashboard from "../screens/CreatorDashboard";
import SettingsScreen from "../screens/SettingsScreen";

export type RootTabParamList = {
  Radar: undefined;
  Explore: undefined;
  Favorites: undefined;
  Map: undefined;
  FlipIt: undefined;
  Creator: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function BottomTabsNavigator() {
  // ── Premium from context — no extra Firestore listener needed ────────────
  // Previously opened its own onSnapshot for premium status on every tab
  // render. Now uses the shared UserContext which is already live.
  const { isPremium, loading } = useUser();

  if (loading) return null;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#FF6C00",
        tabBarInactiveTintColor: "#999",
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0.5,
          borderTopColor: "#ddd",
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home-outline";
          switch (route.name) {
            case "Radar": iconName = "radio-outline"; break;
            case "Explore": iconName = "search-outline"; break;
            case "Favorites": iconName = "heart-outline"; break;
            case "Map": iconName = "map-outline"; break;
            case "FlipIt": iconName = "rocket-outline"; break;
            case "Creator": iconName = "bar-chart-outline"; break;
            case "Settings": iconName = "settings-outline"; break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Radar" component={RadarScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="FlipIt" component={FlipItScreen} />
      {isPremium && (
        <Tab.Screen
          name="Creator"
          component={CreatorDashboard}
          options={{
            title: "Creator",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}