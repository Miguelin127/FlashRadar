// flashradar/screens/TestBackground.tsx
import React from "react";
import { StyleSheet, ImageBackground } from "react-native";

export default function TestBackground() {
  return (
    <ImageBackground
      source={require("../assets/background.png")}
      style={styles.bg}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
});
