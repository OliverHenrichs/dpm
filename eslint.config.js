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
      // Node-run config files at the root.
      "*.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
  {
    // Colours come from the theme (src/common/theme/tokens.ts). A literal here
    // is a colour that ignores dark mode and slips past the contrast test —
    // add a role, or use an existing one, instead.
    files: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: [
      "src/common/theme/tokens.ts",
      // Data, not UI: the colours a user picks for a pattern type.
      "src/pattern/types/PatternType.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/]",
          message:
            "Colour literal: take it from the theme (theme.colors, theme.media) in src/common/theme/tokens.ts.",
        },
      ],
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
