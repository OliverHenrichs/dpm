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
    // Down from 41/32/40/43 not because coverage fell, but because six more
    // well-covered files moved out of this pool and into their own entries
    // below. The leftovers are the graph views and their SVG rendering.
    global: {
      statements: 43,
      branches: 32,
      functions: 44,
      lines: 44,
    },
    // The data layer handles user data that cannot be recreated if lost, so it
    // is held to a much higher bar than the UI.
    //
    // The floors sit a few points under the measured values because a file
    // imported by both projects is instrumented twice — once by ts-jest, once
    // by babel via jest-expo — and the merged branch count differs by a few
    // points between those transforms. Leave headroom rather than chase it.
    "src/pattern/data/PatternListStorage.ts": {
      statements: 88,
      branches: 82,
      functions: 90,
      lines: 88,
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
    // Lower than it was: the B1/B2 fallback pass is now a deep safety net
    // that healthy *and* degenerate input both bypass, because the model's
    // depth map treats a node with no resolvable prerequisite as a root. The
    // net stays; see the comment on the pass itself.
    "src/pattern/graph/utils/NetworkGraphUtils.ts": {
      statements: 64,
      branches: 56,
      functions: 66,
      lines: 64,
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
    "src/pattern/filter/hooks/usePatternFilter.ts": {
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
    "src/pattern/graph/PatternDetailsModal.tsx": {
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
    // The screen's modal wiring, the filter/sort sheets and the carousel.
    "src/pattern/list/PatternListManager.tsx": {
      statements: 94,
      branches: 84,
      functions: 94,
      lines: 94,
    },
    "src/pattern/filter/components/PatternFilterBottomSheet.tsx": {
      statements: 86,
      branches: 50,
      functions: 78,
      lines: 86,
    },
    "src/pattern/list/SortBottomSheet.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/TagPickerBottomSheet.tsx": {
      statements: 92,
      branches: 82,
      functions: 94,
      lines: 94,
    },
    "src/pattern/list/PatternTags.tsx": {
      statements: 90,
      branches: 68,
      functions: 84,
      lines: 90,
    },
    "src/common/components/VideoCarousel.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    // F3: the gate between a picked file and storage, and the schema runner.
    "src/pattern/data/validation/validateExportData.ts": {
      statements: 84,
      branches: 80,
      functions: 94,
      lines: 84,
    },
    "src/pattern/data/types/ExportVersion.ts": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/data/migrations/index.ts": {
      statements: 84,
      branches: 64,
      functions: 90,
      lines: 84,
    },
    "src/pattern/data/migrations/001_normaliseShape.ts": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    // F2: the graph's domain layer. It is pure, cheap and used by every view,
    // so it is held near-total. The branch floors are lower than the rest
    // because `Map.get` is typed `T | undefined` and each `??` fallback is a
    // branch that `buildAdjacency`'s own guarantee makes unreachable.
    //
    // `adjacency.ts` is the clearest case of the double-instrumentation swing
    // described on the global block: the unit project exercises all of it and
    // reports 91/67/89/96, while the components project reaches it only
    // through `GenericGraphUtils` (storage's prerequisite repair), never runs
    // `buildDepthMap`, and reports 78/58/75/78. Whichever copy wins the merge
    // decides the run, so the floor sits under the *lower* pole.
    "src/pattern/graph/model/adjacency.ts": {
      statements: 74,
      branches: 54,
      functions: 70,
      lines: 74,
    },
    // L2: the manual layout. `resolveLayout` decides what happens to an
    // arrangement the user built by hand when the pattern set changes
    // underneath it, so it is held near-total; its uncovered branches are
    // defensive `?? []` fallbacks over maps that always have an entry.
    "src/pattern/graph/model/resolveLayout.ts": {
      statements: 90,
      branches: 72,
      functions: 90,
      lines: 88,
    },
    "src/pattern/graph/data/GraphLayoutStorage.ts": {
      statements: 82,
      branches: 80,
      functions: 84,
      lines: 82,
    },
    "src/pattern/graph/data/GraphLayoutKeys.ts": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    // L2 step 3: dragging. The gesture maths is held total — a node that does
    // not track the finger is the defect this whole design exists to avoid —
    // and so are the two animated renderers, whose worklets decide where the
    // node and its edges are actually drawn.
    // Both poles of the double-instrumentation swing have been observed for
    // these: the unit project exercises them fully, the components project
    // reaches them only through the screen. The floors sit under the lower.
    "src/pattern/graph/model/canvasMetrics.ts": {
      statements: 62,
      branches: 45,
      functions: 48,
      lines: 62,
    },
    "src/pattern/graph/components/GraphDragHint.tsx": {
      statements: 94,
      branches: 80,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/data/GraphHintStorage.ts": {
      statements: 78,
      branches: 82,
      functions: 84,
      lines: 78,
    },
    "src/pattern/graph/model/graphCoordinates.ts": {
      statements: 94,
      branches: 85,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/hooks/useNodeDrag.ts": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/hooks/useGraphPositions.ts": {
      statements: 94,
      branches: 80,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/render/DragOverlay.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/render/DraggedEdge.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/render/GraphPrimitives.tsx": {
      statements: 86,
      branches: 78,
      functions: 94,
      lines: 94,
    },
    // L2: the pan/pinch canvas that replaced the PanResponder-based zoomable
    // view. Its gestures cannot be dispatched under jest, but the arithmetic
    // they drive can: the mock records each registered handler and the tests
    // call them, which is where the focal-point and clamping bugs live.
    "src/pattern/graph/components/ZoomableCanvas.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/components/CanvasTransformContext.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    // L1: the filtering layer. `filterGraphModel` is what stops a narrowed
    // graph losing nodes, so it is held near-total on statements and lines;
    // its branch floor is lower because the same double-instrumentation swing
    // documented on the global block moves it by several points between runs
    // (69.4 and 76.8 both observed), and the floor goes under the worse one.
    "src/pattern/graph/model/selectSubgraph.ts": {
      statements: 94,
      branches: 72,
      functions: 95,
      lines: 95,
    },
    "src/pattern/graph/model/filterGraphModel.ts": {
      statements: 96,
      branches: 64,
      functions: 95,
      lines: 95,
    },
    "src/pattern/graph/hooks/useGraphFilter.ts": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/components/ChainModeFilter.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/components/GraphFilterSummary.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    // The cycle detector's first user-visible output: it used to console.warn.
    "src/pattern/graph/CycleWarning.tsx": {
      statements: 94,
      branches: 94,
      functions: 94,
      lines: 94,
    },
    "src/pattern/graph/model/GraphModel.ts": {
      statements: 95,
      branches: 45,
      // Lower than the rest: both poles of the double-instrumentation swing
      // have been seen here (100 and 83), and the floor goes under the lower.
      functions: 80,
      lines: 95,
    },
    "src/pattern/list/PatternList.tsx": {
      statements: 82,
      branches: 85,
      functions: 66,
      lines: 82,
    },
  },
};
