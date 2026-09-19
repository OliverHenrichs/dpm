import React, { createContext, useContext, useState } from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";

export type ThemeType = "light" | "dark" | "system";

export interface ThemeContextProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colorScheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: "system",
  setTheme: () => {},
  colorScheme: "light",
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<ThemeType>("system");
  const systemColorScheme = useNativeColorScheme(); // "light" | "dark" | null

  // Derived straight from the inputs — no state/effect needed, so the very
  // first render already paints in the right scheme.
  const colorScheme: "light" | "dark" =
    theme === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
