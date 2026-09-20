/**
 * Two projects, deliberately separate:
 *
 * - `unit` runs pure TypeScript (storage, graph maths, hooks-free helpers) in a
 *   plain node environment through ts-jest. It needs no React Native runtime,
 *   so it stays fast — this is where the bulk of the suite should live.
 * - `components` runs anything that renders, through the `jest-expo` preset,
 *   which supplies the React Native + Expo module environment.
 *
 * Keeping them apart means a slow RN environment never taxes the fast tests,
 * and `npm test -- --selectProjects unit` stays a sub-second feedback loop.
 */

const tsJestTransform = {
  "^.+\\.(ts|tsx)$": [
    "ts-jest",
    {
      tsconfig: "<rootDir>/tsconfig.jest.json",
    },
  ],
};

/** Expo and React Native ship untranspiled ESM; Babel has to see it. */
const transformIgnorePatterns = [
  "node_modules/(?!(?:jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-vector-icons|@openspacelabs/.*)",
];

module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/__tests__/unit/**/*.(test|spec).(ts|tsx|js)"],
      transform: tsJestTransform,
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.unit.ts"],
    },
    {
      displayName: "components",
      preset: "jest-expo",
      testMatch: [
        "<rootDir>/__tests__/components/**/*.(test|spec).(ts|tsx|js)",
      ],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      transformIgnorePatterns,
      setupFilesAfterEnv: ["<rootDir>/jest.setup.components.ts"],
    },
  ],

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],

  // A ratchet, not a target. Each floor sits just under what is actually
  // covered today, so CI is green on arrival and any regression below the
  // current line fails the build. Raise these as suites land; never lower them.
  //
  // The global numbers are low because most of src/ is UI that has no tests
  // yet. That is the backlog (see AGENT_TASKS.md F1), not the target.
  coverageThreshold: {
    // NB: these are keyed off the numbers jest reports when a threshold is
    // *missed*, which differ from the summary table's percentages — the two
    // use different denominators. Read a failure message, not the table.
    global: {
      statements: 15,
      branches: 9,
      functions: 14,
      lines: 18,
    },
    // The data layer handles user data that cannot be recreated if lost, so it
    // is held to a much higher bar than the UI.
    //
    // The floors sit a few points under the measured values because a file
    // imported by both projects is instrumented twice — once by ts-jest, once
    // by babel via jest-expo — and the merged branch count differs by a few
    // points between those transforms. Leave headroom rather than chase it.
    "src/pattern/data/PatternListStorage.ts": {
      statements: 78,
      branches: 50,
      functions: 75,
      lines: 78,
    },
    // Export/import moves data that cannot be recreated if the format breaks,
    // and the two modules only agree through the on-disk shape — so both ends
    // are held near-total and the suite exercises them as a round trip.
    "src/pattern/data/exportPatterns.ts": {
      statements: 90,
      branches: 70,
      functions: 95,
      lines: 95,
    },
    "src/pattern/data/ImportPatterns.ts": {
      statements: 95,
      branches: 78,
      functions: 95,
      lines: 95,
    },
  },
};
