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
  ios: {
    // Required for prebuild/EAS; there is no app.json for the CLI to write it
    // into, so it has to live here. Mirrors android.package.
    bundleIdentifier: "com.teholi.DancePatternMapper",
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
    package: "com.teholi.DancePatternMapper",
  },
  web: {
    output: "static",
    favicon: "./assets/images/app-icon.png",
  },
  plugins: [
    "expo-router",
    // The iOS usage strings below exist only because these plugins are listed;
    // config plugins are not applied by autolinking. Without them iOS kills the
    // app the first time it touches the camera or the photo library.
    [
      "expo-camera",
      {
        // Both plugins write these iOS strings and this one's win (listed first, its mods run
        // last), so they carry both uses: QR scanning here, recording in expo-image-picker.
        cameraPermission:
          "Allow $(PRODUCT_NAME) to use the camera to scan a pattern list share code or record a video for a pattern.",
        microphonePermission:
          "Allow $(PRODUCT_NAME) to record sound with the videos you take for a pattern.",
        // Android's system camera app records the audio itself; the app never needs it.
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow $(PRODUCT_NAME) to access your videos so you can attach them to a pattern.",
        cameraPermission:
          "Allow $(PRODUCT_NAME) to use the camera to scan a pattern list share code or record a video for a pattern.",
        // "Record a video" hands over to the system camera. On iOS that capture records sound
        // and needs this string, or iOS terminates the app. Android's camera app records the
        // audio itself; RECORD_AUDIO stays blocked by expo-camera's recordAudioAndroid: false.
        microphonePermission:
          "Allow $(PRODUCT_NAME) to record sound with the videos you take for a pattern.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon-dark.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/images/splash-icon-light.png",
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-video",
    "expo-localization",
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
