const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    // Jest runs these in a node environment with its own globals
    files: ["__tests__/**/*.{ts,tsx,js}", "jest.setup.js", "jest.config.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    // Build output and Expo-generated files (all gitignored) — linting them
    // just churns, since `expo start` rewrites them.
    ignores: ["dist/*", ".expo/**", "expo-env.d.ts"],
  },
]);
