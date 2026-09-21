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
      // Mock call history must not leak between tests, or an assertion can
      // pass on a call another test made.
      clearMocks: true,
      testMatch: ["<rootDir>/__tests__/unit/**/*.(test|spec).(ts|tsx|js)"],
      transform: tsJestTransform,
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.unit.ts"],
    },
    {
      displayName: "components",
      preset: "jest-expo",
      clearMocks: true,
      testMatch: [
        "<rootDir>/__tests__/components/**/*.(test|spec).(ts|tsx|js)",
      ],
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      transformIgnorePatterns,
      setupFilesAfterEnv: ["<rootDir>/jest.setup.components.ts"],
    },
  ],

  // Root level on purpose: `testTimeout` is not a valid per-project option —
  // Jest ignores it there and only warns ("Unknown option"), so a per-project
  // value silently does nothing.
  //
  // Generous because `npm ci` wipes the Babel cache, so the first component
  // test on a CI runner pays to transform the whole React Native + Expo tree
  // before it can render: ~330ms warm, ~3.5s here with caches cleared, and
  // more on a slower runner. This catches a hang, it does not enforce speed.
  testTimeout: 60000,

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
    // NB: a file with its own entry below is *removed* from this global pool,
    // so pinning well-covered files pushes this number down. It measures what
    // is left over — mostly untested UI — not the project as a whole.
    // Generous headroom: the global figure swings several points between
    // otherwise identical runs, because files imported by both projects are
    // instrumented twice and the merge depends on which worker saw them first.
    // Set a floor under the lowest of several runs, not under the best one.
    global: {
      statements: 41,
      branches: 32,
      functions: 40,
      lines: 43,
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
    // The mutations behind every pattern and modifier edit.
    "src/pattern/list/hooks/usePatternCrud.ts": {
      statements: 90,
      branches: 82,
      functions: 92,
      lines: 92,
    },
    // Prerequisite integrity: the helpers that stop nodes vanishing from the
    // graph, and the layout that must place every node it is given.
    "src/pattern/graph/utils/GenericGraphUtils.ts": {
      statements: 68,
      branches: 64,
      functions: 60,
      lines: 72,
    },
    "src/pattern/graph/utils/NetworkGraphUtils.ts": {
      statements: 76,
      branches: 68,
      functions: 80,
      lines: 78,
    },
    // The import/export decision hooks: what lands in storage on a conflict.
    "src/pattern/data/hooks/useImportDecisions.ts": {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
    "src/pattern/data/hooks/useExportSelection.ts": {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
    "src/settings/hooks/useDataTransfer.ts": {
      statements: 88,
      branches: 58,
      functions: 84,
      lines: 90,
    },
    "src/settings/SettingsScreen.tsx": {
      statements: 82,
      branches: 90,
      functions: 68,
      lines: 82,
    },
    // The other path that creates lists, and the header whose title used to
    // sit on top of the home button.
    "src/pattern/list/PatternListTemplateModal.tsx": {
      statements: 86,
      branches: 86,
      functions: 78,
      lines: 86,
    },
    "src/common/components/AppHeader.tsx": {
      statements: 88,
      branches: 55,
      functions: 74,
      lines: 88,
    },
    // Cloud sharing: publishing, unpublishing and subscribing.
    "src/pattern/list/ShareListModal.tsx": {
      statements: 90,
      branches: 80,
      functions: 86,
      lines: 94,
    },
    "src/pattern/list/SubscribeListModal.tsx": {
      statements: 86,
      branches: 80,
      functions: 84,
      lines: 88,
    },
    "src/pattern/list/hooks/usePatternFilter.ts": {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
    "src/pattern/list/hooks/usePatternSort.ts": {
      statements: 88,
      branches: 84,
      functions: 95,
      lines: 95,
    },
    // Pattern editing: the form, its video handling and the variant strip.
    "src/pattern/list/EditPatternForm.tsx": {
      statements: 78,
      branches: 64,
      functions: 72,
      lines: 81,
    },
    "src/pattern/list/ModifierPillStrip.tsx": {
      statements: 90,
      branches: 84,
      functions: 86,
      lines: 90,
    },
    "src/pattern/list/PatternVideos.tsx": {
      statements: 94,
      branches: 74,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/AddVideoModal.tsx": {
      statements: 78,
      branches: 62,
      functions: 94,
      lines: 85,
    },
    // The modifier tab, and the dialogs/sheets every screen builds on.
    "src/pattern/list/ModifierList.tsx": {
      statements: 88,
      branches: 84,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/ModifierListItem.tsx": {
      statements: 94,
      branches: 80,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/ModifierDetails.tsx": {
      statements: 94,
      branches: 70,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/EditModifierForm.tsx": {
      statements: 76,
      branches: 46,
      functions: 78,
      lines: 80,
    },
    "src/common/components/AppDialog.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/common/components/BottomSheet.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/PatternDetails.tsx": {
      statements: 92,
      branches: 72,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/PatternList.tsx": {
      statements: 82,
      branches: 85,
      functions: 66,
      lines: 82,
    },
  },
};
