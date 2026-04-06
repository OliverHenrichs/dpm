import { ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config — reads Firebase credentials from environment variables
 * so that no secrets are stored in app.json or committed to the repository.
 *
 * Local development: create a .env file (see .env.example).
 * EAS builds: add each variable as an EAS Secret
 *   (https://docs.expo.dev/build-reference/variables/#using-secrets-in-eas-build).
 *
 * Expo automatically loads .env when running `expo start` or `eas build`,
 * so no manual dotenv setup is required.
 */

export default (): ExpoConfig => ({
  name: "DancePatternMapper",
  slug: "DancePatternMapper",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/app-icon.png",
  scheme: "dancepatternmapper",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    icon: {
      dark: "./assets/images/ios-dark.png",
      light: "./assets/images/ios-light.png",
      tinted: "./assets/images/ios-tinted.png",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      monochromeImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#18181b",
    },
    edgeToEdgeEnabled: true,
    package: "com.teholi.DancePatternMapper",
  },
  web: {
    output: "static",
    favicon: "./assets/images/app-icon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon-dark.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#f5f3ff",
        dark: {
          image: "./assets/images/splash-icon-light.png",
          backgroundColor: "#18181b",
        },
      },
    ],
    "expo-video",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "af32961a-d382-4766-86aa-3b3ccafbaa2d",
    },
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    },
    firebaseAppToken: process.env.FIREBASE_APP_TOKEN,
  },
});
