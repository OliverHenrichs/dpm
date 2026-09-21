import React from "react";
import {
  render,
  renderHook,
  RenderHookOptions,
  RenderOptions,
} from "@testing-library/react-native";
import { I18nextProvider } from "react-i18next";
import i18n from "@/src/i18n";
import { ThemeProvider } from "@/src/common/components/ThemeContext";
import { ActivePatternListProvider } from "@/src/pattern/data/components/ActivePatternListContext";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";

export interface RenderWithProvidersOptions extends RenderOptions {
  /** Lists to place in storage before the provider mounts. */
  lists?: IPatternList[];
  /** Patterns per list id, placed in storage before the provider mounts. */
  patterns?: Record<string, IPattern[]>;
  /**
   * Which list the provider should come up with as active. Defaults to the
   * first seeded list; pass `null` for the genuine no-active-list state (which
   * also keeps the header from repeating a list name the test asserts on).
   */
  activeListId?: string | null;
  /** Language to render in. Defaults to English. */
  language?: string;
}

/**
 * Renders a component inside the same provider stack the real app uses —
 * theme, i18n and the active-pattern-list context — with storage seeded first,
 * because `ActivePatternListProvider` reads AsyncStorage on mount.
 *
 * Seeding happens synchronously before render, so the provider's first load
 * already sees the data; tests still need to `await` something (a `findBy*`
 * query or `waitFor`) for that async load to settle.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    lists = [],
    patterns = {},
    activeListId,
    language = "en",
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  const Wrapper = buildWrapper({ lists, patterns, activeListId, language });
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/**
 * Build the provider wrapper and seed storage, without rendering anything.
 * Shared by `renderWithProviders` and `renderHookWithProviders`.
 */
function buildWrapper({
  lists = [],
  patterns = {},
  activeListId,
  language = "en",
}: Omit<RenderWithProvidersOptions, keyof RenderOptions>) {
  const seed: Record<string, string> = {};
  if (lists.length > 0) seed["@patternLists"] = JSON.stringify(lists);
  for (const [listId, listPatterns] of Object.entries(patterns)) {
    seed[`@patterns_${listId}`] = JSON.stringify(listPatterns);
  }
  const resolvedActiveId =
    activeListId === null ? undefined : (activeListId ?? lists[0]?.id);
  if (resolvedActiveId) seed["@activeListId"] = resolvedActiveId;
  seedAsyncStorage(seed);

  if (i18n.language !== language) {
    void i18n.changeLanguage(language);
  }

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ActivePatternListProvider>{children}</ActivePatternListProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
  return Wrapper;
}

/**
 * Renders a hook inside the same provider stack, for logic that reads the
 * active list. `ActivePatternListProvider` loads storage on mount, so a test
 * must `await waitFor(...)` on the loaded state before acting.
 */
export function renderHookWithProviders<Result>(
  hook: () => Result,
  {
    lists = [],
    patterns = {},
    activeListId,
    language = "en",
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const wrapper = buildWrapper({ lists, patterns, activeListId, language });
  return renderHook(hook, {
    wrapper,
    ...(options as RenderHookOptions<never>),
  });
}

export * from "@testing-library/react-native";
