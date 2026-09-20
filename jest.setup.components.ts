// @testing-library/react-native v13 registers its Jest matchers automatically;
// the separate @testing-library/jest-native package is deprecated and gone.
import { resetAsyncStorageMock } from "./__mocks__/@react-native-async-storage/async-storage";
import { resetFileSystemMock } from "./__mocks__/expo-file-system";

beforeEach(() => {
  resetAsyncStorageMock();
  resetFileSystemMock();
});

// ---------------------------------------------------------------------------
// Native modules with no usable JS implementation under jest.
// Each mock is deliberately minimal: enough for a component to render and for
// a test to assert it was asked to do something, and no more.
// ---------------------------------------------------------------------------

jest.mock("expo-video", () => ({
  useVideoPlayer: jest.fn(() => ({
    loop: false,
    currentTime: 0,
    play: jest.fn(),
    pause: jest.fn(),
  })),
  VideoView: "VideoView",
}));

jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: jest.fn(async () => ({ uri: "file:///thumb.jpg" })),
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({
    granted: true,
  })),
  MediaTypeOptions: { Videos: "Videos" },
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Error: "error" },
}));

// react-native-youtube-iframe pulls in react-native-webview, which has no
// usable jest implementation. See AGENTS.md — the YouTube player is kept behind
// YouTubeVideoItem precisely so it can be swapped out like this.
jest.mock("react-native-youtube-iframe", () => "YoutubePlayer");

jest.mock("react-native-qrcode-svg", () => "QRCode");

// The firebase SDK ships untranspiled ESM that jest cannot parse, and adding it
// to transformIgnorePatterns would mean Babel-compiling the whole SDK for every
// suite. Mocking is both faster and closer to how the app behaves without
// credentials: firebaseConfig exports `firebaseAvailable === false` and every
// service call no-ops rather than crashing. Tests that exercise sharing should
// mock `@/src/firebase/FirebaseListService` directly instead.
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  onSnapshot: jest.fn(() => () => {}),
}));

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
