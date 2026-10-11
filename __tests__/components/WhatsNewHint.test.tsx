import React from "react";
import WhatsNewHint from "@/src/changelog/components/WhatsNewHint";
import { CHANGELOG } from "@/src/changelog/changelog";
import { createTestPatternList } from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";

const latest = CHANGELOG[0];
const previous = CHANGELOG[1];
const title = `What's new in ${latest.version}`;
const hidden = { includeHiddenElements: true };

describe("WhatsNewHint", () => {
  it("shows what changed since the version last seen", async () => {
    seedAsyncStorage({ "@changelogSeenVersion": previous.version });
    renderWithProviders(<WhatsNewHint />, { lists: [createTestPatternList()] });

    expect(await screen.findByText(title, hidden)).toBeOnTheScreen();
    expect(screen.getByText(latest.notes.en[0], hidden)).toBeOnTheScreen();
    expect(screen.queryByText(previous.notes.en[0], hidden)).toBeNull();
  });

  it("records the version once closed", async () => {
    seedAsyncStorage({ "@changelogSeenVersion": previous.version });
    renderWithProviders(<WhatsNewHint />, { lists: [createTestPatternList()] });

    fireEvent.press(await screen.findByText("Got it", hidden));

    expect(peekAsyncStorage()["@changelogSeenVersion"]).toBe(latest.version);
  });

  it("can show every version", async () => {
    seedAsyncStorage({ "@changelogSeenVersion": previous.version });
    renderWithProviders(<WhatsNewHint />, { lists: [createTestPatternList()] });

    fireEvent.press(await screen.findByText("All changes", hidden));

    expect(screen.getByText(previous.notes.en[0], hidden)).toBeOnTheScreen();
  });

  it("stays away on a first install, and records the version", async () => {
    renderWithProviders(<WhatsNewHint />);

    await waitFor(() =>
      expect(peekAsyncStorage()["@changelogSeenVersion"]).toBe(latest.version),
    );
    expect(screen.queryByText(title, hidden)).toBeNull();
  });

  it("stays away when turned off in Settings", async () => {
    seedAsyncStorage({
      "@changelogSeenVersion": previous.version,
      "@whatsNewHintEnabled": "false",
    });
    renderWithProviders(<WhatsNewHint />, { lists: [createTestPatternList()] });

    await waitFor(() =>
      expect(peekAsyncStorage()["@changelogSeenVersion"]).toBe(latest.version),
    );
    expect(screen.queryByText(title, hidden)).toBeNull();
  });
});
