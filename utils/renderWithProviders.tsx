import React from "react";
import { render, RenderOptions } from "@testing-library/react-native";
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
  /** Which list the provider should come up with as active. */
  activeListId?: string;
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
  const seed: Record<string, string> = {};
  if (lists.length > 0) seed["@patternLists"] = JSON.stringify(lists);
  for (const [listId, listPatterns] of Object.entries(patterns)) {
    seed[`@patterns_${listId}`] = JSON.stringify(listPatterns);
  }
  const resolvedActiveId = activeListId ?? lists[0]?.id;
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

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from "@testing-library/react-native";
