// flashradar/navigation/BottomTabsNavigator.tsx
import React, { useEffect, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

import RadarScreen from "../screens/RadarScreen";
import ExploreScreen from "../screens/ExploreScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import MapScreen from "../screens/MapScreen";
import FlipItScreen from "../screens/FlipItScreen";
import SettingsScreen from "../screens/SettingsScreen";

export type RootTabParamList = {
  Radar: undefined;
  Explore: undefined;
  Favorites: undefined;
  Map: undefined;
  FlipIt: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function BottomTabsNavigator() {
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  // 🔥 Listen for premium status in real time
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setIsPremium(false);
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsub = onSnapshot(userRef, (docSnap) => {
      const data = docSnap.data();
      setIsPremium(data?.isPremium === true);
    });

    return () => unsub();
  }, []);

  if (isPremium === null) return null; // Wait for Firestore

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
            case "Radar":
              iconName = "radio-outline";
              break;
            case "Explore":
              iconName = "search-outline";
              break;
            case "Favorites":
              iconName = "heart-outline";
              break;
            case "Map":
              iconName = "map-outline";
              break;
            case "FlipIt":
              iconName = "rocket-outline";
              break;
            case "Settings":
              iconName = "settings-outline";
              break;
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
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
