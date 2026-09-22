import { resetAsyncStorageMock } from "./__mocks__/@react-native-async-storage/async-storage";
import { resetFileSystemMock } from "./__mocks__/expo-file-system";
import { resetDeviceLocalesMock } from "./__mocks__/expo-localization";

// Every unit test starts from an empty store. Without this, storage state
// leaks between tests and failures depend on execution order.
beforeEach(() => {
  resetAsyncStorageMock();
  resetFileSystemMock();
  resetDeviceLocalesMock();
});

// The production code logs expected, handled conditions (a missing video on
// import, a circular dependency in the graph) through console.warn/error.
// Silence them so a passing run is quiet, but keep them as spies so a test can
// assert that a warning *was* emitted.
beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
