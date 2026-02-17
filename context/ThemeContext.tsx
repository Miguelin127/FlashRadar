// flashradar/context/ThemeContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { Appearance, useColorScheme } from "react-native";

type Theme = "light" | "dark";

interface ThemeColors {
  background: string;
  text: string;
  subtext: string;
  card: string;
  accent: string;
  accentLight: string;
}

interface ThemeContextType {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
  darkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  colors: {
    background: "#fff",
    text: "#000",
    subtext: "#555",
    card: "#f4f4f4",
    accent: "#FF6600",
    accentLight: "#FFA500",
  },
  toggleTheme: () => {},
  darkMode: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme() ?? "light";

  const [theme, setTheme] = useState<Theme>(systemScheme);
  const [manualOverride, setManualOverride] = useState(false);

  // 👇 ONLY follow system if user has NOT manually chosen
  useEffect(() => {
    if (manualOverride) return;

    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      if (colorScheme) setTheme(colorScheme);
    });

    return () => listener.remove();
  }, [manualOverride]);

  const toggleTheme = () => {
    setManualOverride(true);
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const colors: ThemeColors =
    theme === "dark"
      ? {
          background: "#000",
          text: "#fff",
          subtext: "#ccc",
          card: "#1c1c1c",
          accent: "#FF6600",
          accentLight: "#FFA500",
        }
      : {
          background: "#fff",
          text: "#000",
          subtext: "#555",
          card: "#f4f4f4",
          accent: "#FF6600",
          accentLight: "#FFA500",
        };

  const darkMode = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, darkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
