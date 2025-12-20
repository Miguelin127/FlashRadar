import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function ScreenWrapper({ children, style }: Props) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }, style]}
      edges={["top", "left", "right", "bottom"]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
