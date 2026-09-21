const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // Jest runs these in a node environment with its own globals
    files: [
      "__tests__/**/*.{ts,tsx,js}",
      "__mocks__/**/*.{ts,tsx,js}",
      "utils/**/*.{ts,tsx}",
      "jest.setup.*.ts",
      "jest.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    // Build output and generated native/Expo files (all gitignored) — linting
    // them just churns, since the tooling rewrites them.
    ignores: [
      "dist/*",
      "dist-web/**",
      "dist-android/**",
      ".expo/**",
      "expo-env.d.ts",
      "android/**",
      "ios/**",
      "coverage/**",
    ],
  },
]);
