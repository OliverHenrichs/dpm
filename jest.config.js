module.exports = {
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx|js)"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "src/pattern/data/**/*.{ts,tsx}",
    "src/pattern/graph/utils/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  testEnvironment: "node",
};
