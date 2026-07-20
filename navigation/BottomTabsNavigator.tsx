// flashradar/navigation/BottomTabsNavigator.tsx

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { useLanguage } from "../context/LanguageContext";
import { getStrings } from "../utils/strings";

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
  const { language } = useLanguage();
  const t = getStrings(language);
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
      <Tab.Screen name="Radar" component={RadarScreen} options={{ title: t.tabs.radar }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ title: t.tabs.explore }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: t.tabs.favorites }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t.tabs.map }} />
      <Tab.Screen name="FlipIt" component={FlipItScreen} options={{ title: t.tabs.flipit }} />
      {isPremium && (
        <Tab.Screen
          name="Creator"
          component={CreatorDashboard}
          options={{
            title: t.tabs.creator,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
      )}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t.tabs.settings }} />
    </Tab.Navigator>
  );
}
