import "./i18n";
import { ThemeProvider } from "@/src/common/components/ThemeContext";
import DrawerNavigator from "@/src/common/components/DrawerNavigator";
import * as SplashScreen from "expo-splash-screen";

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});
SplashScreen.preventAutoHideAsync();

export default function Index() {
  return (
    <ThemeProvider>
      <DrawerNavigator />
    </ThemeProvider>
  );
}
