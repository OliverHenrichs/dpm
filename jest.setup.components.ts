// @testing-library/react-native v13 registers its Jest matchers automatically;
// the separate @testing-library/jest-native package is deprecated and gone.
import { configure } from "@testing-library/react-native";
import { resetAsyncStorageMock } from "./__mocks__/@react-native-async-storage/async-storage";
import { resetFileSystemMock } from "./__mocks__/expo-file-system";

// `waitFor` defaults to 1s, which is not enough for the first mount of the
// full provider stack on a cold CI runner — and it would surface as a
// confusing assertion error rather than as a timeout.
configure({ asyncUtilTimeout: 10000 });

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

// Screens render AppHeader, which resolves the drawer navigator. There is no
// navigator in a component test, so stand the router down to the four APIs the
// app actually uses (verified by grep over src/). Tests that care about
// navigation assert on `router.navigate`.
jest.mock("expo-router", () => ({
  router: { navigate: jest.fn(), push: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ openDrawer: jest.fn(), closeDrawer: jest.fn() }),
  usePathname: () => "/patterns",
  useFocusEffect: (callback: () => void | (() => void)) => {
    // The real hook runs on focus; in a test the screen is always focused.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    require("react").useEffect(callback, []);
  },
}));

// generateVideoThumbnails reaches expo-video-thumbnails through a dynamic
// `await import(...)`, which jest's CJS VM rejects outright ("A dynamic import
// callback was invoked without --experimental-vm-modules") — so mocking
// expo-video-thumbnails is not enough, the call site has to be replaced. Every
// form that edits videos runs this on mount. The rest of the module is real.
jest.mock("@/src/common/utils/YouTubeUtils", () => ({
  ...jest.requireActual("@/src/common/utils/YouTubeUtils"),
  generateVideoThumbnails: jest.fn(async (refs: unknown[]) =>
    refs.map(() => ""),
  ),
}));

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
