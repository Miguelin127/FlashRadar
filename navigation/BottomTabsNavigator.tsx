import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../context/UserContext";
import { useLanguage } from "../context/LanguageContext";
import { firebase } from "../firebaseConfig";
import { getStrings } from "../utils/strings";

import RadarStackNavigator from "./RadarStackNavigator";
import ExploreStackNavigator from "./ExploreStackNavigator";
import FavoritesScreen from "../screens/FavoritesScreen";
import MapScreen from "../screens/MapScreen";
import FlipItScreen from "../screens/FlipItScreen";
import CreatorDashboard from "../screens/CreatorDashboard";
import SettingsStackNavigator from "./SettingsStackNavigator";
import ShoppingIntelligenceScreen from "../screens/ShoppingIntelligenceScreen";

export type RootTabParamList = {
  Radar: undefined;
  Explore: undefined;
  Favorites: undefined;
  Map: undefined;
  Shopping: undefined;
  FlipIt: undefined;
  Creator: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function BottomTabsNavigator() {
  const { language } = useLanguage();
  const t = getStrings(language);
  const { isPremium, loading } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = firebase.auth().currentUser;
    setIsAdmin(user?.email === 'miguelx.x127@gmail.com');
  }, []);

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
            case "Shopping": iconName = "analytics"; break;
            case "FlipIt": iconName = "rocket-outline"; break;
            case "Creator": iconName = "bar-chart-outline"; break;
            case "Settings": iconName = "settings-outline"; break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Radar" component={RadarStackNavigator} options={{ title: t.tabs.radar }} />
      <Tab.Screen name="Explore" component={ExploreStackNavigator} options={{ title: t.tabs.explore }} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} options={{ title: t.tabs.favorites }} />
      <Tab.Screen name="Shopping" component={ShoppingIntelligenceScreen} options={{ title: 'Shopping' }} />
      <Tab.Screen name="FlipIt" component={FlipItScreen} options={{ title: t.tabs.flipit }} />
      {isPremium && (
        <Tab.Screen name="Creator" component={CreatorDashboard} options={{ title: t.tabs.creator }} />
      )}
      <Tab.Screen name="Settings" component={SettingsStackNavigator} options={{ title: t.tabs.settings }} />
    </Tab.Navigator>
  );
}
