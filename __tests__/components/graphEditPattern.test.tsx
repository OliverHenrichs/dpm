import React, { act } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToSharedList } from "@/src/firebase/FirebaseListService";
import { getSuggestionStanding } from "@/src/firebase/PatternSuggestionService";
import { TERMS_VERSION } from "@/src/legal/TermsStorage";
import PatternGraphScreen from "@/src/pattern/graph/PatternGraphScreen";
import MemoPatternNode from "@/src/pattern/graph/PatternNode";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
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

// A getter, so one suite can see both a phone with sharing and one without.
let mockFirebaseOn = false;
jest.mock("@/src/firebase/firebaseConfig", () => ({
  get firebaseAvailable() {
    return mockFirebaseOn;
  },
  db: {},
  APP_TOKEN: "test-token",
  SHARED_LISTS_COLLECTION: "sharedLists",
}));

jest.mock("@/src/firebase/FirebaseListService", () => ({
  syncPublishedList: jest.fn(),
  subscribeToSharedList: jest.fn(),
}));

jest.mock("@/src/firebase/PatternSuggestionService", () => ({
  getSuggestionStanding: jest.fn(),
  submitSuggestion: jest.fn(),
}));

beforeEach(() => {
  mockFirebaseOn = false;
  (subscribeToSharedList as jest.Mock).mockReturnValue(() => {});
  (getSuggestionStanding as jest.Mock).mockResolvedValue({
    muted: false,
    remaining: 2,
  });
  // The legend opens by itself the first time, and suggesting asks for the terms of use once;
  // neither is what these tests are about.
  seedAsyncStorage({
    "@graphLegendSeen": "true",
    "@termsAccepted": TERMS_VERSION,
  });
});

const TYPE = createTestPatternType({ slug: "push" });
const SUGAR_PUSH = createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" });
const WHIP = createTestPattern(TYPE.id, {
  id: 2,
  name: "Whip",
  prerequisites: [1],
});

/** The box component inside `React.memo`, which the type queries cannot see through. */
const PatternNode = (MemoPatternNode as unknown as { type: React.FC }).type;

async function renderGraph(overrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList({ patternTypes: [TYPE], ...overrides });
  renderWithProviders(<PatternGraphScreen />, {
    lists: [list],
    patterns: { [list.id]: [SUGAR_PUSH, WHIP] },
  });
  // SVG text is not text to the queries: wait for the boxes themselves.
  await waitFor(() =>
    expect(screen.UNSAFE_getAllByType(PatternNode)).toHaveLength(2),
  );
  return list;
}

/** The name in a figure's box in the timeline. */
const boxNames = () =>
  screen.UNSAFE_getAllByType(PatternNode).map((n) => n.props.node.pattern.name);

/**
 * Taps a figure's box in the timeline, which opens its details. The timeline's boxes take
 * taps through `onPress` (`PatternNodeGroup`); an SVG group is no target for `fireEvent`.
 */
async function openDetails(name: string) {
  const box = screen
    .UNSAFE_getAllByType(PatternNode)
    .find((n) => n.props.node.pattern.name === name)!;
  await act(async () => box.props.onPress(box.props.node.pattern));
  return screen.findByLabelText("Dismiss details");
}

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

describe("editing a figure from the Map", () => {
  it("opens the List tab's form from the details, and saves through it", async () => {
    const list = await renderGraph();
    await openDetails("Sugar Push");

    fireEvent.press(screen.getByLabelText("Edit Figure"));

    // The figure form, on this figure; the details step aside meanwhile.
    expect(await screen.findByDisplayValue("Sugar Push")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Dismiss details")).toBeNull();

    fireEvent.changeText(
      screen.getByDisplayValue("Sugar Push"),
      "Sugar Push (traveling)",
    );
    fireEvent.press(screen.getByText("Save"));

    await waitFor(async () =>
      expect((await storedPatterns(list.id))[0].name).toBe(
        "Sugar Push (traveling)",
      ),
    );
    // Back on the Map, the details show the change in place.
    const close = await screen.findByLabelText("Dismiss details");
    expect(close).toBeOnTheScreen();
    expect(screen.queryByDisplayValue("Sugar Push (traveling)")).toBeNull();
    expect(screen.getByText("Sugar Push (traveling)")).toBeOnTheScreen();
    expect(boxNames()).toContain("Sugar Push (traveling)");
    // The rest of the figure is untouched.
    const [saved, whip] = await storedPatterns(list.id);
    expect(saved).toEqual({ ...SUGAR_PUSH, name: "Sugar Push (traveling)" });
    expect(whip).toEqual(WHIP);
  });

  it("keeps the figure as it was on cancel, and returns to its details", async () => {
    const list = await renderGraph();
    await openDetails("Whip");
    fireEvent.press(screen.getByLabelText("Edit Figure"));
    fireEvent.changeText(await screen.findByDisplayValue("Whip"), "Whipped");

    fireEvent.press(screen.getByText("Cancel"));

    expect(await screen.findByLabelText("Dismiss details")).toBeOnTheScreen();
    expect(screen.queryByDisplayValue("Whipped")).toBeNull();
    expect((await storedPatterns(list.id))[1].name).toBe("Whip");
  });

  it("keeps the form open when the save is refused", async () => {
    const list = await renderGraph();
    await openDetails("Sugar Push");
    fireEvent.press(screen.getByLabelText("Edit Figure"));
    const name = await screen.findByDisplayValue("Sugar Push");

    fireEvent.changeText(name, "   ");
    fireEvent.press(screen.getByText("Save"));

    // Still the form; nothing written.
    expect(await screen.findByDisplayValue("   ")).toBeOnTheScreen();
    expect((await storedPatterns(list.id))[0].name).toBe("Sugar Push");
  });

  it("closes the form with the back button", async () => {
    await renderGraph();
    await openDetails("Sugar Push");
    fireEvent.press(screen.getByLabelText("Edit Figure"));
    const name = await screen.findByDisplayValue("Sugar Push");

    // The form's own modal: the nearest ancestor with onRequestClose.
    let node = name.parent;
    while (node && !node.props.onRequestClose) node = node.parent;
    fireEvent(node!, "requestClose");

    expect(await screen.findByLabelText("Dismiss details")).toBeOnTheScreen();
  });

  it("offers no edit on a read-only list", async () => {
    await renderGraph({ readonly: true });
    const close = await openDetails("Sugar Push");

    expect(close).toBeOnTheScreen();
    expect(screen.queryByLabelText("Edit Figure")).toBeNull();
    expect(screen.queryByLabelText("Suggest a change")).toBeNull();
  });

  it("offers a subscriber 'Suggest a change' when the list owner takes changes", async () => {
    mockFirebaseOn = true;
    await renderGraph({
      readonly: true,
      shareCode: "AB12CD34",
      suggestions: { dailyLimit: 3, per: "subscriber", edits: true },
    });
    await openDetails("Sugar Push");
    expect(screen.queryByLabelText("Edit Figure")).toBeNull();

    fireEvent.press(screen.getByLabelText("Suggest a change"));

    // The List tab's suggestion form, on this figure.
    expect(await screen.findByText(/reviews your change/)).toBeOnTheScreen();
    expect(screen.queryByLabelText("Dismiss details")).toBeNull();
  });

  it("offers a subscriber nothing when the list owner takes new figures only", async () => {
    mockFirebaseOn = true;
    await renderGraph({
      readonly: true,
      shareCode: "AB12CD34",
      suggestions: { dailyLimit: 3, per: "subscriber" },
    });
    const close = await openDetails("Sugar Push");

    expect(close).toBeOnTheScreen();
    expect(screen.queryByLabelText("Suggest a change")).toBeNull();
    expect(screen.queryByLabelText("Edit Figure")).toBeNull();
  });
});
