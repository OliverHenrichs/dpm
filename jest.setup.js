// Jest setup file
// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  removeMany: jest.fn(),
}));

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
