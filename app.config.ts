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

/**
 * Build variants, chosen by APP_VARIANT (set per profile in eas.json; set it by hand for a local
 * `npx expo run:android`). Each variant has its own application id, so a development client, a
 * sideloaded preview and the Play Store install live side by side on one phone instead of failing
 * to install over each other: Android refuses an update signed with a different certificate, and
 * every variant is signed differently (local debug keystore, EAS keystore, Play app signing key).
 * Unset means production, so a release can never ship under a variant id by accident.
 */
const APP_ID = "com.teholi.DancePatternMapper";
const VARIANTS = {
  development: { idSuffix: ".dev", nameSuffix: " (Dev)" },
  preview: { idSuffix: ".preview", nameSuffix: " (Preview)" },
  production: { idSuffix: "", nameSuffix: "" },
} as const;
type Variant = keyof typeof VARIANTS;

function resolveVariant(raw: string | undefined): Variant {
  if (raw === undefined || raw === "") return "production";
  if (raw in VARIANTS) return raw as Variant;
  throw new Error(
    `Unknown APP_VARIANT "${raw}"; expected ${Object.keys(VARIANTS).join(", ")}`,
  );
}

/** Embedded font files, one family per entry (see the expo-font plugin below). */
export const FONT_FAMILIES: {
  family: string;
  files: { path: string; weight: number; style?: "italic" }[];
}[] = [
  {
    family: "Manrope",
    files: [
      { path: "./assets/fonts/Manrope_400Regular.ttf", weight: 400 },
      { path: "./assets/fonts/Manrope_600SemiBold.ttf", weight: 600 },
      { path: "./assets/fonts/Manrope_700Bold.ttf", weight: 700 },
    ],
  },
  {
    family: "DM Serif Display",
    files: [
      { path: "./assets/fonts/DMSerifDisplay_400Regular.ttf", weight: 400 },
      {
        path: "./assets/fonts/DMSerifDisplay_400Regular_Italic.ttf",
        weight: 400,
        style: "italic",
      },
    ],
  },
  {
    family: "IBM Plex Sans Condensed",
    files: [
      {
        path: "./assets/fonts/IBMPlexSansCondensed_400Regular.ttf",
        weight: 400,
      },
      {
        path: "./assets/fonts/IBMPlexSansCondensed_600SemiBold.ttf",
        weight: 600,
      },
      {
        path: "./assets/fonts/IBMPlexSansCondensed_700Bold.ttf",
        weight: 700,
      },
    ],
  },
  {
    family: "IBM Plex Mono",
    files: [
      { path: "./assets/fonts/IBMPlexMono_400Regular.ttf", weight: 400 },
      { path: "./assets/fonts/IBMPlexMono_600SemiBold.ttf", weight: 600 },
    ],
  },
];

const variant = VARIANTS[resolveVariant(process.env.APP_VARIANT)];
const appId = APP_ID + variant.idSuffix;

export default (): ExpoConfig => ({
  name: "DPM" + variant.nameSuffix,
  slug: "DancePatternMapper",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/app-icon.png",
  // Distinct per variant, so a deep link opens one app rather than an Android chooser.
  scheme: "dancepatternmapper" + variant.idSuffix.replace(".", "-"),
  userInterfaceStyle: "automatic",
  ios: {
    // Required for prebuild/EAS; there is no app.json for the CLI to write it
    // into, so it has to live here. Mirrors android.package.
    bundleIdentifier: appId,
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
    package: appId,
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
        // The themes' `background` tokens (src/common/theme/tokens.ts), so the
        // splash hands over to the first screen without a flash of another colour.
        backgroundColor: "#f5f3ff",
        dark: {
          image: "./assets/images/splash-icon-light.png",
          backgroundColor: "#18181b",
        },
      },
    ],
    "expo-video",
    // Says when video jobs finish while the app is in the background (src/anonymize/jobs/
    // jobNotifications.ts). Prebuild would apply this plugin anyway once the package is
    // installed; it is listed for the icon, which Android draws white on the status bar. On iOS it
    // also writes the aps-environment entitlement, so the App ID needs Push Notifications enabled.
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#4f46e5",
      },
    ],
    "expo-localization",
    // The two styles' typefaces, embedded natively (SIL Open Font License, assets/fonts/*-OFL.txt):
    // Manrope and DM Serif Display for After Hours, IBM Plex Sans Condensed and Plex Mono for
    // Clipboard. On Android each family is registered under the files' own family name, so
    // `fontWeight` picks the right file as it does on iOS, where the name comes from the files.
    // Only the weights the type scales use are shipped (src/common/theme/tokens.ts). Web uses
    // system stacks instead.
    [
      "expo-font",
      {
        ios: {
          fonts: FONT_FAMILIES.flatMap(({ files }) =>
            files.map(({ path }) => path),
          ),
        },
        android: {
          fonts: FONT_FAMILIES.map(({ family, files }) => ({
            fontFamily: family,
            fontDefinitions: files,
          })),
        },
      },
    ],
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
