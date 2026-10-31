import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { PATTERN_TYPE_COLORS } from "@/src/pattern/types/PatternType";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
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
  seedAsyncStorage({ "@graphLegendSeen": "true" });
});

const TYPE = createTestPatternType({
  slug: "push",
  color: PATTERN_TYPE_COLORS.coral,
});

async function renderGraph(overrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList({ patternTypes: [TYPE], ...overrides });
  renderWithProviders(<PatternGraphScreen />, {
    lists: [list],
    patterns: { [list.id]: [createTestPattern(TYPE.id, { id: 1 })] },
  });
  await screen.findByLabelText("Filter Figures");
  fireEvent.press(screen.getByText("Legend"));
  return list;
}

const storedTypes = async (listId: string) => {
  const lists: IPatternList[] = JSON.parse(
    (await AsyncStorage.getItem("@patternLists")) ?? "[]",
  );
  return lists.find((l) => l.id === listId)!.patternTypes;
};

describe("recolouring a type from the Map's legend", () => {
  it("saves the colour picked on the list", async () => {
    const list = await renderGraph();

    fireEvent.press(await screen.findByLabelText("Colour of push"));
    const swatches = screen.getAllByRole("radio");
    // The palette's last colour, which is not coral.
    fireEvent.press(swatches[swatches.length - 1]);

    const palette = Object.values(PATTERN_TYPE_COLORS);
    await waitFor(async () =>
      expect((await storedTypes(list.id))[0].color).toBe(
        palette[palette.length - 1],
      ),
    );
  });

  it("is not offered on a read-only list", async () => {
    await renderGraph({ readonly: true });

    expect(await screen.findByText("push lane")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Colour of push")).toBeNull();
  });
});
