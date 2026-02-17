// flashradar/App.tsx

import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import RootNavigator from "./navigation/RootNavigator";

function AppWithTheme() {
  const { darkMode } = useTheme();

  return (
    <NavigationContainer theme={darkMode ? DarkTheme : DefaultTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <AppWithTheme />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
