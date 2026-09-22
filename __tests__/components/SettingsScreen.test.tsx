import React from "react";
import i18n, { restoreStoredLanguage } from "@/src/i18n";
import { exportPatternLists } from "@/src/pattern/data/exportPatterns";
import { importPatternLists } from "@/src/pattern/data/ImportPatterns";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import SettingsScreen from "@/src/settings/SettingsScreen";
import { LANGUAGES } from "@/src/settings/types/Languages";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";
import { peekAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";

jest.mock("@/src/pattern/data/exportPatterns", () => ({
  exportPatternLists: jest.fn(),
}));
jest.mock("@/src/pattern/data/ImportPatterns", () => ({
  importPatternLists: jest.fn(),
}));
jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

const mockedExport = exportPatternLists as jest.MockedFunction<
  typeof exportPatternLists
>;
const mockedImport = importPatternLists as jest.MockedFunction<
  typeof importPatternLists
>;

beforeEach(() => {
  mockedExport.mockResolvedValue({ success: true, message: "ok" });
  mockedImport.mockResolvedValue({ success: true, message: "ok" });
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

// The screen changes the shared i18n instance, so put it back afterwards or
// every later suite renders in whatever language ran last.
afterEach(async () => {
  if (i18n.language !== "en") await i18n.changeLanguage("en");
});

const importable = (
  overrides: Partial<PatternListWithPatterns> = {},
): PatternListWithPatterns => ({
  ...createTestPatternList(),
  patterns: [],
  ...overrides,
});

async function renderSettings(lists = [createTestPatternList()]) {
  renderWithProviders(<SettingsScreen />, { lists, activeListId: null });
  await waitFor(() => expect(screen.getByText("Theme")).toBeOnTheScreen());
}

describe("SettingsScreen", () => {
  describe("sections", () => {
    it("shows language, theme and data transfer", async () => {
      await renderSettings();

      expect(screen.getByText("Language")).toBeOnTheScreen();
      expect(screen.getByText("Theme")).toBeOnTheScreen();
      expect(screen.getByText("Data Transfer")).toBeOnTheScreen();
    });

    it("shows the current language on a single row", async () => {
      await renderSettings();

      // The row, not a button per language — nine of those do not fit.
      expect(screen.getByText("English")).toBeOnTheScreen();
      expect(screen.queryByText("Deutsch")).toBeNull();
    });

    it("offers all three theme choices", async () => {
      await renderSettings();

      expect(screen.getByText("System Default")).toBeOnTheScreen();
      expect(screen.getByText("Light")).toBeOnTheScreen();
      expect(screen.getByText("Dark")).toBeOnTheScreen();
    });
  });

  describe("language", () => {
    const openPicker = async () => {
      fireEvent.press(screen.getByLabelText("Language: English"));
      await waitFor(() =>
        expect(screen.getByText("Select Language")).toBeOnTheScreen(),
      );
    };

    it("opens the picker with every configured language", async () => {
      await renderSettings();

      await openPicker();

      // Via the accessibility label, because the row behind the sheet still
      // carries the current language's own name.
      for (const language of LANGUAGES) {
        const label =
          language.englishName === language.label
            ? language.label
            : `${language.label} (${language.englishName})`;
        expect(screen.getByLabelText(label)).toBeOnTheScreen();
      }
    });

    it("labels a language in another script with its English name too", async () => {
      // The way back for someone who picked a script they cannot read.
      await renderSettings();

      await openPicker();

      expect(screen.getByLabelText("বাংলা (Bengali)")).toBeOnTheScreen();
      expect(screen.getByLabelText("中文 (Chinese)")).toBeOnTheScreen();
    });

    it("does not gloss English with its own name", async () => {
      await renderSettings();

      await openPicker();

      expect(screen.queryByLabelText("English (English)")).toBeNull();
    });

    it("marks the current language as selected", async () => {
      await renderSettings();

      await openPicker();

      expect(
        screen.getByLabelText("English").props.accessibilityState?.selected,
      ).toBe(true);
      expect(
        screen.getByLabelText("Deutsch (German)").props.accessibilityState
          ?.selected,
      ).toBe(false);
    });

    it("switches the whole screen when another is picked", async () => {
      await renderSettings();

      await openPicker();
      fireEvent.press(screen.getByText("Deutsch"));

      await waitFor(() =>
        expect(screen.getByText("Sprache")).toBeOnTheScreen(),
      );
    });

    it("remembers the language that was picked", async () => {
      // What the root layout does on startup; without it nothing is watching
      // for the change, which is the bug this covers.
      await restoreStoredLanguage();
      await renderSettings();

      await openPicker();
      fireEvent.press(screen.getByText("Deutsch"));

      await waitFor(() => expect(peekAsyncStorage()["@language"]).toBe("de"));
    });

    it("switches into a non-Latin script too", async () => {
      await renderSettings();

      await openPicker();
      fireEvent.press(screen.getByText("العربية"));

      await waitFor(() => expect(screen.getByText("اللغة")).toBeOnTheScreen());
    });
  });

  describe("theme", () => {
    it("keeps the screen usable after switching", async () => {
      await renderSettings();

      fireEvent.press(screen.getByText("Dark"));

      expect(screen.getByText("Theme")).toBeOnTheScreen();
    });

    it("remembers the choice across launches", async () => {
      await renderSettings();

      fireEvent.press(screen.getByText("Dark"));

      await waitFor(() => expect(peekAsyncStorage()["@theme"]).toBe("dark"));
    });
  });

  describe("export", () => {
    it("opens the list picker when there is something to export", async () => {
      await renderSettings([createTestPatternList({ name: "Salsa" })]);

      fireEvent.press(screen.getByText("Export / Share"));

      await waitFor(() => expect(screen.getByText("Salsa")).toBeOnTheScreen());
    });

    it("explains itself when there is nothing to export", async () => {
      await renderSettings([]);

      fireEvent.press(screen.getByText("Export / Share"));

      await waitFor(() =>
        expect(
          screen.getByText("No pattern lists to export"),
        ).toBeOnTheScreen(),
      );
    });
  });

  describe("import", () => {
    it("opens the decision modal with what was read", async () => {
      mockedImport.mockResolvedValue({
        success: true,
        message: "ok",
        patternLists: [importable({ name: "Incoming" })],
      });
      await renderSettings();

      fireEvent.press(screen.getByText("Import"));

      await waitFor(() =>
        expect(screen.getByText("Incoming")).toBeOnTheScreen(),
      );
    });

    it("defaults a conflicting list to skip, not replace", async () => {
      // End-to-end cover for the bug where the modal mounts before the
      // imported lists arrive, so the skip-on-conflict default never applied
      // and an existing list was silently overwritten.
      const existing = createTestPatternList({ name: "Mine" });
      mockedImport.mockResolvedValue({
        success: true,
        message: "ok",
        patternLists: [importable({ id: existing.id, name: "Mine" })],
      });
      await renderSettings([existing]);

      fireEvent.press(screen.getByText("Import"));

      await waitFor(() =>
        expect(screen.getByText("Import Pattern Lists")).toBeOnTheScreen(),
      );
      // The conflicting row offers Skip as the chosen action.
      const isSelected = (label: string) =>
        screen.getByLabelText(label).props.accessibilityState?.selected;
      expect(isSelected("Skip")).toBe(true);
      expect(isSelected("Replace")).toBe(false);
    });

    it("says nothing when the file picker is cancelled", async () => {
      mockedImport.mockResolvedValue({
        success: false,
        cancelled: true,
        message: "",
      });
      await renderSettings();

      fireEvent.press(screen.getByText("Import"));

      await waitFor(() => expect(mockedImport).toHaveBeenCalled());
      expect(screen.queryByText("Import Pattern Lists")).toBeNull();
    });

    it("reports an unreadable file", async () => {
      mockedImport.mockResolvedValue({
        success: false,
        message: "Invalid import file format",
      });
      await renderSettings();

      fireEvent.press(screen.getByText("Import"));

      await waitFor(() =>
        expect(
          screen.getByText("Invalid import file format"),
        ).toBeOnTheScreen(),
      );
    });
  });
});
