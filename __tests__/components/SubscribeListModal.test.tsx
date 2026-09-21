import React from "react";
import { useCameraPermissions } from "expo-camera";
import SubscribeListModal from "@/src/pattern/list/SubscribeListModal";
import { fetchSharedList } from "@/src/firebase/FirebaseListService";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

// See ShareListModal.test.tsx — jest-expo supplies no config extras, so this
// is mocked rather than inherited from the environment.
let mockFirebaseAvailable = true;
jest.mock("@/src/firebase/firebaseConfig", () => ({
  get firebaseAvailable() {
    return mockFirebaseAvailable;
  },
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
}));

jest.mock("@/src/firebase/FirebaseListService", () => ({
  fetchSharedList: jest.fn(),
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

/**
 * Stands in for the camera. When the modal opens the scanner, this renders a
 * single pressable that reports `mockScanValue` — letting a test drive the
 * scan path without a camera or a real QR code.
 */
let mockScanValue = "ABCD1234";
jest.mock("@/src/common/components/QrCodeScanner", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      visible,
      onScanned,
    }: {
      visible: boolean;
      onScanned: (data: string) => void;
    }) =>
      visible ? (
        <Text
          accessibilityLabel="fake-scanner"
          onPress={() => onScanned(mockScanValue)}
        >
          scanner
        </Text>
      ) : null,
  };
});

const mockedFetch = fetchSharedList as jest.MockedFunction<
  typeof fetchSharedList
>;

beforeEach(() => {
  mockFirebaseAvailable = true;
  mockScanValue = "ABCD1234";
  mockedFetch.mockResolvedValue(null);
  (useCameraPermissions as jest.Mock).mockReturnValue([
    { granted: true },
    jest.fn(async () => ({ granted: true })),
  ]);
});

const shared = (
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns => ({
  ...createTestPatternList({ name: "Shared Salsa" }),
  patterns: [createTestPattern("t", { id: 1 })],
  ...overrides,
});

function renderSubscribe(existingLists: IPatternList[] = []) {
  const onClose = jest.fn();
  const onSubscribe = jest.fn<void, [PatternListWithPatterns]>();
  renderWithProviders(
    <SubscribeListModal
      visible
      existingLists={existingLists}
      onClose={onClose}
      onSubscribe={onSubscribe}
    />,
    { activeListId: null },
  );
  return { onClose, onSubscribe };
}

const codeInput = () => screen.getByPlaceholderText("ABC12345");
const lookUp = (code: string) => {
  fireEvent.changeText(codeInput(), code);
  fireEvent(codeInput(), "submitEditing");
};

describe("SubscribeListModal", () => {
  describe("entering a code", () => {
    it("upper-cases what is typed", () => {
      renderSubscribe();

      fireEvent.changeText(codeInput(), "abcd1234");

      expect(codeInput().props.value).toBe("ABCD1234");
    });

    it("rejects a code that is not eight characters", async () => {
      renderSubscribe();

      lookUp("ABC");

      await waitFor(() =>
        expect(
          screen.getByText("Code must be exactly 8 characters."),
        ).toBeOnTheScreen(),
      );
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("looks the code up once it is complete", async () => {
      renderSubscribe();

      lookUp("abcd1234");

      await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith("ABCD1234"));
    });
  });

  describe("a successful lookup", () => {
    it("previews the list and how much is in it", async () => {
      mockedFetch.mockResolvedValue(shared());
      renderSubscribe();

      lookUp("ABCD1234");

      await waitFor(() =>
        expect(screen.getByText("Shared Salsa")).toBeOnTheScreen(),
      );
      expect(screen.getByText("1 patterns")).toBeOnTheScreen();
    });

    it("hands the fetched list over on confirmation", async () => {
      const list = shared();
      mockedFetch.mockResolvedValue(list);
      const { onSubscribe, onClose } = renderSubscribe();

      lookUp("ABCD1234");
      await waitFor(() =>
        expect(screen.getByText("Shared Salsa")).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText("Subscribe"));

      expect(onSubscribe).toHaveBeenCalledWith(list);
      expect(onClose).toHaveBeenCalled();
    });

    it("will not subscribe before a list has been found", () => {
      const { onSubscribe } = renderSubscribe();

      fireEvent.press(screen.getByText("Subscribe"));

      expect(onSubscribe).not.toHaveBeenCalled();
    });
  });

  describe("lookups that should not proceed", () => {
    it("reports a code nobody has published", async () => {
      mockedFetch.mockResolvedValue(null);
      renderSubscribe();

      lookUp("ABCD1234");

      await waitFor(() =>
        expect(
          screen.getByText("No shared list found for this code."),
        ).toBeOnTheScreen(),
      );
    });

    it("refuses a list the user already publishes", async () => {
      // Same UUID *and* the same share code: this is the publisher's own list.
      const own = createTestPatternList({ shareCode: "ABCD1234" });
      mockedFetch.mockResolvedValue(shared({ id: own.id }));
      renderSubscribe([own]);

      lookUp("ABCD1234");

      await waitFor(() =>
        expect(
          screen.getByText(
            "You are the publisher of this list — it is already in your library.",
          ),
        ).toBeOnTheScreen(),
      );
    });

    it("refuses a list the user already subscribes to", async () => {
      const already = createTestPatternList({ shareCode: "ZZZZ9999" });
      mockedFetch.mockResolvedValue(shared({ id: already.id }));
      renderSubscribe([already]);

      lookUp("ABCD1234");

      await waitFor(() =>
        expect(
          screen.getByText("You are already subscribed to this list."),
        ).toBeOnTheScreen(),
      );
    });

    it("offers no preview to confirm when it refused", async () => {
      const own = createTestPatternList({ shareCode: "ABCD1234" });
      mockedFetch.mockResolvedValue(
        shared({ id: own.id, name: "Shared Salsa" }),
      );
      const { onSubscribe } = renderSubscribe([own]);

      lookUp("ABCD1234");
      await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
      fireEvent.press(screen.getByText("Subscribe"));

      expect(screen.queryByText("Shared Salsa")).toBeNull();
      expect(onSubscribe).not.toHaveBeenCalled();
    });

    it("surfaces a network failure", async () => {
      mockedFetch.mockRejectedValue(new Error("offline"));
      renderSubscribe();

      lookUp("ABCD1234");

      await waitFor(() =>
        expect(screen.getByText("offline")).toBeOnTheScreen(),
      );
    });

    it("clears a previous error as soon as the code is edited", async () => {
      renderSubscribe();

      lookUp("ABC");
      await waitFor(() =>
        expect(
          screen.getByText("Code must be exactly 8 characters."),
        ).toBeOnTheScreen(),
      );
      fireEvent.changeText(codeInput(), "ABCD");

      expect(
        screen.queryByText("Code must be exactly 8 characters."),
      ).toBeNull();
    });
  });

  describe("closing", () => {
    it("forgets the code and the preview", async () => {
      mockedFetch.mockResolvedValue(shared());
      const { onClose } = renderSubscribe();

      lookUp("ABCD1234");
      await waitFor(() =>
        expect(screen.getByText("Shared Salsa")).toBeOnTheScreen(),
      );
      fireEvent.press(screen.getByText("Cancel"));

      expect(onClose).toHaveBeenCalled();
      expect(codeInput().props.value).toBe("");
      expect(screen.queryByText("Shared Salsa")).toBeNull();
    });
  });

  describe("scanning a QR code", () => {
    const openScanner = () =>
      fireEvent.press(screen.getByLabelText("Scan QR code"));
    const scan = () => fireEvent.press(screen.getByLabelText("fake-scanner"));

    it("opens the scanner when permission is already granted", async () => {
      renderSubscribe();

      openScanner();

      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
    });

    it("asks for permission first, and gives up if refused", async () => {
      (useCameraPermissions as jest.Mock).mockReturnValue([
        { granted: false },
        jest.fn(async () => ({ granted: false })),
      ]);
      renderSubscribe();

      openScanner();

      await waitFor(() =>
        expect(screen.getByText("Camera permission denied")).toBeOnTheScreen(),
      );
      expect(screen.queryByLabelText("fake-scanner")).toBeNull();
    });

    it("fills in the code and looks it up straight away", async () => {
      mockedFetch.mockResolvedValue(shared());
      renderSubscribe();

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith("ABCD1234"));
      await waitFor(() =>
        expect(screen.getByText("Shared Salsa")).toBeOnTheScreen(),
      );
      expect(codeInput().props.value).toBe("ABCD1234");
    });

    it("upper-cases and trims what it scanned", async () => {
      mockScanValue = "  abcd1234  ";
      mockedFetch.mockResolvedValue(shared());
      renderSubscribe();

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      await waitFor(() => expect(mockedFetch).toHaveBeenCalledWith("ABCD1234"));
    });

    it("rejects a QR code that is not a share code", async () => {
      mockScanValue = "https://example.com";
      renderSubscribe();

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      await waitFor(() =>
        expect(
          screen.getByText("Code must be exactly 8 characters."),
        ).toBeOnTheScreen(),
      );
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    it("applies the same refusals as a typed code", async () => {
      const own = createTestPatternList({ shareCode: "ABCD1234" });
      mockedFetch.mockResolvedValue(shared({ id: own.id }));
      renderSubscribe([own]);

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      await waitFor(() =>
        expect(
          screen.getByText(
            "You are the publisher of this list — it is already in your library.",
          ),
        ).toBeOnTheScreen(),
      );
    });

    it("surfaces a network failure from the scanned lookup", async () => {
      mockedFetch.mockRejectedValue(new Error("offline"));
      renderSubscribe();

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      await waitFor(() =>
        expect(screen.getByText("offline")).toBeOnTheScreen(),
      );
    });

    it("closes the scanner once something is scanned", async () => {
      mockedFetch.mockResolvedValue(shared());
      renderSubscribe();

      openScanner();
      await waitFor(() =>
        expect(screen.getByLabelText("fake-scanner")).toBeOnTheScreen(),
      );
      scan();

      // Wait for something to *appear* — the preview the scan triggers — then
      // assert the scanner is gone synchronously. Polling for a node's absence
      // inside `waitFor` is unreliable on a loaded runner; see AGENTS.md.
      await waitFor(() =>
        expect(screen.getByText("Shared Salsa")).toBeOnTheScreen(),
      );
      expect(screen.queryByLabelText("fake-scanner")).toBeNull();
    });
  });

  describe("without firebase credentials", () => {
    beforeEach(() => {
      mockFirebaseAvailable = false;
    });

    it("explains why subscribing is unavailable", () => {
      renderSubscribe();

      expect(
        screen.getByText(
          "Cloud sharing is not configured. Add Firebase credentials to app.json.",
        ),
      ).toBeOnTheScreen();
    });

    it("offers no code entry at all", () => {
      renderSubscribe();

      expect(screen.queryByPlaceholderText("ABC12345")).toBeNull();
      expect(screen.queryByText("Subscribe")).toBeNull();
    });
  });
});
