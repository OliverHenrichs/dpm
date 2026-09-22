import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";
import { loadStoredTheme, saveTheme } from "@/src/settings/data/ThemeStorage";
import { ThemeType } from "@/src/settings/types/Themes";

export type { ThemeType } from "@/src/settings/types/Themes";

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

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  /** Called once the stored theme has been applied, or found missing. */
  onRestored?: () => void;
}> = ({ children, onRestored }) => {
  const [theme, setThemeState] = useState<ThemeType>("system");
  const systemColorScheme = useNativeColorScheme(); // "light" | "dark" | null
  const chosenRef = useRef(false);
  const restoreStartedRef = useRef(false);

  // Comes up on "system" and switches once storage answers. Only once: a
  // choice made while the read was in flight is newer than what it returns.
  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    void loadStoredTheme().then((stored) => {
      if (stored && !chosenRef.current) setThemeState(stored);
      onRestored?.();
    });
  }, [onRestored]);

  const setTheme = (next: ThemeType) => {
    chosenRef.current = true;
    setThemeState(next);
    void saveTheme(next);
  };

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
