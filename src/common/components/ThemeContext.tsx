import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useColorScheme as useNativeColorScheme } from "react-native";
import { UnistylesRuntime } from "react-native-unistyles";
import { loadStoredTheme, saveTheme } from "@/src/settings/data/ThemeStorage";
import { ThemeType } from "@/src/settings/types/Themes";
import { loadStoredStyle, saveStyle } from "@/src/settings/data/StyleStorage";
import { AppStyle, DEFAULT_APP_STYLE } from "@/src/common/theme/tokens";
import { applyAppStyle } from "@/src/common/theme/unistyles";

export type { ThemeType } from "@/src/settings/types/Themes";

export interface ThemeContextProps {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  colorScheme: "light" | "dark";
  /** The app's style (After Hours or Clipboard), independent of light and dark. */
  appStyle: AppStyle;
  setAppStyle: (style: AppStyle) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: "system",
  setTheme: () => {},
  colorScheme: "light",
  appStyle: DEFAULT_APP_STYLE,
  setAppStyle: () => {},
});

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  /** Called once the stored theme has been applied, or found missing. */
  onRestored?: () => void;
}> = ({ children, onRestored }) => {
  const [theme, setThemeState] = useState<ThemeType>("system");
  const [appStyle, setAppStyleState] = useState<AppStyle>(DEFAULT_APP_STYLE);
  const styleChosenRef = useRef(false);
  const systemColorScheme = useNativeColorScheme(); // "light" | "dark" | null
  const chosenRef = useRef(false);
  const restoreStartedRef = useRef(false);

  // Comes up on "system" and switches once storage answers. Only once: a
  // choice made while the read was in flight is newer than what it returns.
  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    void Promise.all([loadStoredTheme(), loadStoredStyle()]).then(
      ([storedTheme, storedStyle]) => {
        if (storedTheme && !chosenRef.current) setThemeState(storedTheme);
        if (storedStyle && !styleChosenRef.current)
          setAppStyleState(storedStyle);
        onRestored?.();
      },
    );
  }, [onRestored]);

  const setTheme = (next: ThemeType) => {
    chosenRef.current = true;
    setThemeState(next);
    void saveTheme(next);
  };

  const setAppStyle = (next: AppStyle) => {
    styleChosenRef.current = true;
    setAppStyleState(next);
    void saveStyle(next);
  };

  // The registered themes start as the default style; any other is swapped in.
  const appliedStyleRef = useRef<AppStyle>(DEFAULT_APP_STYLE);
  useEffect(() => {
    if (appliedStyleRef.current === appStyle) return;
    appliedStyleRef.current = appStyle;
    applyAppStyle(appStyle);
  }, [appStyle]);

  // Unistyles owns the styles, so it has to hear about the choice. Adaptive
  // themes follow the system on their own; a fixed choice switches that off.
  useEffect(() => {
    UnistylesRuntime.setAdaptiveThemes(theme === "system");
    if (theme !== "system") UnistylesRuntime.setTheme(theme);
  }, [theme]);

  // Derived straight from the inputs — no state/effect needed, so the very
  // first render already paints in the right scheme.
  const colorScheme: "light" | "dark" =
    theme === "system"
      ? systemColorScheme === "dark"
        ? "dark"
        : "light"
      : theme;

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, colorScheme, appStyle, setAppStyle }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => useContext(ThemeContext);
