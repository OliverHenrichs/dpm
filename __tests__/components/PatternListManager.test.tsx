import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import PatternListManager from "@/src/pattern/list/PatternListManager";
import {
  IModifier,
  IPattern,
  IPatternList,
} from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternList,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "@/utils/renderWithProviders";

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

beforeEach(() => {
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
});

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (id: number, name: string, overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE.id, { id, name, ...overrides });

const modifier = (name = "with a spin"): IModifier => ({
  id: generateUUID(),
  name,
  position: "postfix",
  universal: false,
  videoRefs: [],
});

async function renderManager(
  patterns: IPattern[] = [],
  listOverrides: Partial<IPatternList> = {},
) {
  const list = createTestPatternList({
    patternTypes: [TYPE],
    ...listOverrides,
  });
  renderWithProviders(<PatternListManager />, {
    lists: [list],
    patterns: { [list.id]: patterns },
  });
  // The provider loads storage on mount; wait for the screen to reflect it.
  // Anchor on the sort button: it is present whether or not the list is
  // read-only, and unlike "Pattern List" it appears exactly once (that string
  // is both the tab label and the section heading).
  await waitFor(() =>
    expect(screen.getByLabelText("Sort Patterns")).toBeOnTheScreen(),
  );
  return { list };
}

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

describe("PatternListManager", () => {
  describe("empty state", () => {
    it("prompts to create a list when there is none", async () => {
      renderWithProviders(<PatternListManager />);

      await waitFor(() =>
        expect(screen.getByText("No pattern lists yet")).toBeOnTheScreen(),
      );
    });
  });

  describe("tabs", () => {
    it("shows the pattern list first", async () => {
      await renderManager([pattern(1, "Sugar Push")]);

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("switches to modifiers and back", async () => {
      const mod = modifier("with a spin");
      await renderManager([pattern(1, "Sugar Push")], { modifiers: [mod] });

      fireEvent.press(screen.getByText(/Modifiers/));
      expect(screen.queryByText("Sugar Push")).toBeNull();
      expect(screen.getByText("with a spin")).toBeOnTheScreen();

      fireEvent.press(screen.getAllByText("Pattern List")[0]);
      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("counts the modifiers on the tab", async () => {
      await renderManager([], { modifiers: [modifier("a"), modifier("b")] });

      expect(screen.getByText("(2)")).toBeOnTheScreen();
    });
  });

  describe("deleting a pattern", () => {
    it("removes it and scrubs it from prerequisites", async () => {
      // End-to-end cover for AGENT_TASKS.md B1, through the real screen.
      const { list } = await renderManager([
        pattern(1, "Sugar Push"),
        pattern(2, "Whip", { prerequisites: [1] }),
      ]);

      fireEvent.press(screen.getAllByLabelText("Delete Pattern")[0]);
      fireEvent.press(screen.getByText("Delete"));

      await waitFor(async () => {
        const stored = await storedPatterns(list.id);
        expect(stored.map((p) => p.name)).toEqual(["Whip"]);
        expect(stored[0].prerequisites).toEqual([]);
      });
    });

    it("leaves the list alone when the dialog is cancelled", async () => {
      const { list } = await renderManager([pattern(1, "Sugar Push")]);

      fireEvent.press(screen.getByLabelText("Delete Pattern"));
      fireEvent.press(screen.getByText("Cancel"));

      expect(await storedPatterns(list.id)).toHaveLength(1);
      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });
  });

  describe("adding a pattern", () => {
    it("persists what the form submits", async () => {
      const { list } = await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.changeText(
        screen.getByPlaceholderText("Pattern Name"),
        "Sugar Push",
      );
      fireEvent.press(screen.getByText("Save"));

      await waitFor(async () =>
        expect((await storedPatterns(list.id)).map((p) => p.name)).toEqual([
          "Sugar Push",
        ]),
      );
    });

    it("keeps the form open when the name is blank", async () => {
      const { list } = await renderManager([]);

      fireEvent.press(screen.getByLabelText("Add Pattern"));
      fireEvent.press(screen.getByText("Save"));

      expect(await storedPatterns(list.id)).toEqual([]);
      // Still showing the form rather than silently discarding the attempt.
      expect(screen.getByPlaceholderText("Pattern Name")).toBeOnTheScreen();
    });
  });

  describe("read-only lists", () => {
    it("hides every mutating affordance", async () => {
      await renderManager([pattern(1, "Sugar Push")], { readonly: true });

      expect(screen.queryByLabelText("Add Pattern")).toBeNull();
      expect(screen.queryByLabelText("Edit Pattern")).toBeNull();
      expect(screen.queryByLabelText("Delete Pattern")).toBeNull();
    });

    it("still shows the patterns", async () => {
      await renderManager([pattern(1, "Sugar Push")], { readonly: true });

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });
  });
});
