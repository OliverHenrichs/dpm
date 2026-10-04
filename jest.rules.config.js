/**
 * Firestore security-rules tests, kept out of `jest.config.js` on purpose:
 * they need the Firestore emulator (Java), which `npm test` and the verify job
 * do not have. Run them with `npm run test:rules`, which starts the emulator
 * around this config.
 */
module.exports = {
  displayName: "rules",
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/rules/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.jest.json" }],
  },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testTimeout: 60000,
};
