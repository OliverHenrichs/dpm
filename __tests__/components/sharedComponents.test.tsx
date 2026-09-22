import React from "react";
import { Text, View } from "react-native";
import AppDialog from "@/src/common/components/AppDialog";
import BottomSheet from "@/src/common/components/BottomSheet";
import VideoCarousel from "@/src/common/components/VideoCarousel";
import PatternDetails from "@/src/pattern/graph/PatternDetails";
import { getPalette } from "@/src/common/utils/ColorPalette";
import { IModifier, IVideoReference } from "@/src/pattern/types/IPatternList";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const palette = getPalette("light");
const TYPE = createTestPatternType({ slug: "push" });

const urlVideo = (value: string, startTime?: number): IVideoReference => ({
  type: "url",
  value,
  ...(startTime !== undefined && { startTime }),
});

describe("AppDialog", () => {
  const renderDialog = (
    props: Partial<React.ComponentProps<typeof AppDialog>> = {},
  ) => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    renderWithProviders(
      <AppDialog
        visible
        title="Delete Pattern"
        message="Are you sure?"
        onClose={onClose}
        {...props}
      />,
      { activeListId: null },
    );
    return { onClose, onConfirm };
  };

  it("shows its title and message", () => {
    renderDialog();

    expect(screen.getByText("Delete Pattern")).toBeOnTheScreen();
    expect(screen.getByText("Are you sure?")).toBeOnTheScreen();
  });

  it("renders nothing while hidden", () => {
    renderDialog({ visible: false });

    expect(screen.queryByText("Delete Pattern")).toBeNull();
  });

  describe("as a single-button notice", () => {
    it("labels the button OK by default", () => {
      renderDialog();

      expect(screen.getByText("OK")).toBeOnTheScreen();
    });

    it("dismisses", () => {
      const { onClose } = renderDialog();

      fireEvent.press(screen.getByText("OK"));

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("as a confirmation", () => {
    it("shows both buttons only when a confirm handler is given", () => {
      const onConfirm = jest.fn();
      renderWithProviders(
        <AppDialog
          visible
          title="T"
          message="M"
          onClose={jest.fn()}
          closeLabel="Cancel"
          confirmLabel="Delete"
          onConfirm={onConfirm}
        />,
        { activeListId: null },
      );

      expect(screen.getByText("Cancel")).toBeOnTheScreen();
      expect(screen.getByText("Delete")).toBeOnTheScreen();
    });

    it("stays single-button when a label is given with no handler", () => {
      renderDialog({ confirmLabel: "Delete" });

      expect(screen.queryByText("Delete")).toBeNull();
    });

    it("reports the confirm separately from the dismiss", () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();
      renderWithProviders(
        <AppDialog
          visible
          title="T"
          message="M"
          onClose={onClose}
          closeLabel="Cancel"
          confirmLabel="Delete"
          onConfirm={onConfirm}
        />,
        { activeListId: null },
      );

      fireEvent.press(screen.getByText("Delete"));

      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

describe("BottomSheet", () => {
  const renderSheet = (visible = true) => {
    const onClose = jest.fn();
    renderWithProviders(
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title="Filter Patterns"
        palette={palette}
      >
        <Text>sheet body</Text>
      </BottomSheet>,
      { activeListId: null },
    );
    return { onClose };
  };

  it("shows its title and children", () => {
    renderSheet();

    expect(screen.getByText("Filter Patterns")).toBeOnTheScreen();
    expect(screen.getByText("sheet body")).toBeOnTheScreen();
  });

  it("renders nothing while hidden", () => {
    renderSheet(false);

    expect(screen.queryByText("sheet body")).toBeNull();
  });

  it("closes from the ✕", () => {
    const { onClose } = renderSheet();

    fireEvent.press(screen.getByText("✕"));

    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when the sheet body itself is pressed", () => {
    // The backdrop closes on press; the sheet stops that bubbling up, which is
    // why the inner Pressable exists at all.
    const { onClose } = renderSheet();

    fireEvent.press(screen.getByText("sheet body"));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("VideoCarousel", () => {
  const { FlatList, View } = require("react-native");

  const renderCarousel = (videoRefs: IVideoReference[]) => {
    const view = renderWithProviders(
      <VideoCarousel videoRefs={videoRefs} palette={palette} />,
      { activeListId: null },
    );
    return view;
  };

  /**
   * The carousel measures itself before rendering anything: it holds
   * `containerWidth` at 0 until `onLayout` fires, and the list is only mounted
   * once that is non-zero. Nothing lays out under jest, so a test has to
   * supply the measurement itself.
   */
  const layout = (width = 320) =>
    fireEvent(screen.UNSAFE_getAllByType(View)[0], "layout", {
      nativeEvent: { layout: { width, height: 200 } },
    });

  /**
   * Drive the visibility callback the way a real scroll would. Called through
   * the prop rather than fireEvent, because onViewableItemsChanged is not a
   * touch event — so the resulting state update needs its own `act`.
   */
  const reportVisible = (viewableItems: { index: number | null }[]) =>
    act(() => {
      screen
        .UNSAFE_getByType(FlatList)
        .props.onViewableItemsChanged({ viewableItems });
    });

  const scrollTo = (index: number) => reportVisible([{ index }]);

  it("renders nothing until it has been measured", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
    ]);

    expect(screen.UNSAFE_queryByType(FlatList)).toBeNull();
  });

  it("mounts the list once it has a width", () => {
    renderCarousel([urlVideo("https://example.com/a.mp4")]);

    layout();

    expect(screen.UNSAFE_getByType(FlatList)).toBeTruthy();
  });

  it("shows no pager for a single video", () => {
    renderCarousel([urlVideo("https://example.com/a.mp4")]);
    layout();

    expect(screen.queryByText("1 / 1")).toBeNull();
  });

  it("pages when there is more than one", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
    ]);
    layout();

    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
  });

  it("follows the scroll position", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
      urlVideo("https://example.com/c.mp4"),
    ]);
    layout();

    scrollTo(2);

    expect(screen.getByText("3 / 3")).toBeOnTheScreen();
  });

  it("ignores a visibility change that reports nothing visible", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
    ]);
    layout();

    scrollTo(1);
    reportVisible([]);

    expect(screen.getByText("2 / 2")).toBeOnTheScreen();
  });

  it("falls back to the first page when the index is missing", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
    ]);
    layout();

    reportVisible([{ index: null }]);

    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
  });

  it("sizes each page to the measured width", () => {
    renderCarousel([urlVideo("https://example.com/a.mp4")]);
    layout(500);

    expect(screen.UNSAFE_getByType(FlatList).props.snapToInterval).toBe(500);
  });

  it("copes with no videos at all", () => {
    renderCarousel([]);
    layout();

    expect(screen.queryByText(/\//)).toBeNull();
  });
});

describe("PatternDetails", () => {
  const modifier = (name: string, overrides: Partial<IModifier> = {}) => ({
    id: generateUUID(),
    name,
    position: "postfix" as const,
    universal: false,
    videoRefs: [],
    ...overrides,
  });

  const renderDetails = (
    props: Partial<React.ComponentProps<typeof PatternDetails>> = {},
  ) =>
    renderWithProviders(
      <PatternDetails
        selectedPattern={createTestPattern(TYPE.id, {
          id: 1,
          name: "Whip",
          counts: 8,
        })}
        patterns={[]}
        patternTypes={[TYPE]}
        palette={palette}
        {...props}
      />,
      { activeListId: null },
    );

  /** Flatten a style prop, which may be an array, into one object. */
  const flattenStyle = (style: unknown): Record<string, unknown> =>
    (Array.isArray(style) ? style.flat(Infinity) : [style])
      .filter(Boolean)
      .reduce<Record<string, unknown>>(
        (merged, part) => ({ ...merged, ...(part as object) }),
        {},
      );

  const hasTopRule = () =>
    screen
      .UNSAFE_getAllByType(View)
      .some((node) => flattenStyle(node.props.style).borderTopWidth === 1);

  it("rules itself off from what is above it by default", () => {
    // It expands directly under a row in PatternListItem, where the rule is
    // what separates the two. Only the details modal turns it off, because
    // its header already has one.
    renderDetails();

    expect(hasTopRule()).toBe(true);
  });

  it("drops the rule when asked", () => {
    renderDetails({ showTopSeparator: false });

    expect(hasTopRule()).toBe(false);
  });

  it("shows counts, type and level", () => {
    renderDetails();

    expect(screen.getByText("8")).toBeOnTheScreen();
    expect(screen.getByText("push")).toBeOnTheScreen();
    expect(screen.getByText("beginner")).toBeOnTheScreen();
  });

  it("falls back to the raw type id when the type is unknown", () => {
    renderDetails({
      selectedPattern: createTestPattern("orphan-type", { id: 1 }),
      patternTypes: [],
    });

    expect(screen.getByText("orphan-type")).toBeOnTheScreen();
  });

  it("omits the description when there is none", () => {
    renderDetails({
      selectedPattern: createTestPattern(TYPE.id, { id: 1, description: "" }),
    });

    expect(screen.queryByText("Test description")).toBeNull();
  });

  describe("prerequisites", () => {
    it("names them", () => {
      const sugar = createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" });
      const whip = createTestPattern(TYPE.id, {
        id: 2,
        name: "Whip",
        prerequisites: [1],
      });
      renderDetails({ selectedPattern: whip, patterns: [sugar, whip] });

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("says so when there are none", () => {
      renderDetails();

      expect(screen.getByText("None (foundational pattern)")).toBeOnTheScreen();
    });

    it("renders nothing for a prerequisite whose pattern is gone", () => {
      // The data layer repairs dangling ids, but a stale in-memory list can
      // still carry one — this must degrade quietly, not throw.
      const whip = createTestPattern(TYPE.id, {
        id: 2,
        name: "Whip",
        prerequisites: [99],
      });
      renderDetails({ selectedPattern: whip, patterns: [whip] });

      // The rest of the details still render…
      expect(screen.getByText(/^Counts/)).toBeOnTheScreen();
      // …and the unresolvable id yields no pill, but is not reported as
      // "foundational" either, since the pattern does claim a prerequisite.
      expect(screen.queryByText("None (foundational pattern)")).toBeNull();
    });
  });

  describe("builds into", () => {
    it("names the patterns that require this one", () => {
      const sugar = createTestPattern(TYPE.id, { id: 1, name: "Sugar Push" });
      const whip = createTestPattern(TYPE.id, {
        id: 2,
        name: "Whip",
        prerequisites: [1],
      });
      renderDetails({ selectedPattern: sugar, patterns: [sugar, whip] });

      expect(screen.getByText("Whip")).toBeOnTheScreen();
    });

    it("says so when nothing does", () => {
      renderDetails();

      expect(screen.getByText("No dependent patterns yet")).toBeOnTheScreen();
    });
  });

  describe("videos", () => {
    it("shows the pattern's own under Base", () => {
      renderDetails({
        selectedPattern: createTestPattern(TYPE.id, {
          id: 1,
          videoRefs: [
            urlVideo("https://example.com/a.mp4"),
            urlVideo("https://example.com/b.mp4"),
          ],
        }),
      });

      expect(screen.getByText("1 / 2")).toBeOnTheScreen();
    });

    it("swaps to a modifier combination's videos when its pill is chosen", () => {
      const spin = modifier("with a spin");
      renderDetails({
        modifiers: [spin],
        selectedPattern: createTestPattern(TYPE.id, {
          id: 1,
          videoRefs: [urlVideo("https://example.com/base.mp4")],
          modifierRefs: [
            {
              modifierId: spin.id,
              videoRefs: [
                urlVideo("https://example.com/c1.mp4"),
                urlVideo("https://example.com/c2.mp4"),
                urlVideo("https://example.com/c3.mp4"),
              ],
            },
          ],
        }),
      });

      fireEvent.press(screen.getByText("with a spin"));

      expect(screen.getByText("1 / 3")).toBeOnTheScreen();
    });

    it("shows a universal modifier's own videos", () => {
      const slow = modifier("slow", {
        universal: true,
        videoRefs: [
          urlVideo("https://example.com/s1.mp4"),
          urlVideo("https://example.com/s2.mp4"),
        ],
      });
      renderDetails({ modifiers: [slow] });

      fireEvent.press(screen.getByText("slow"));

      expect(screen.getByText("1 / 2")).toBeOnTheScreen();
    });
  });

  describe("tags", () => {
    it("lists them", () => {
      renderDetails({
        selectedPattern: createTestPattern(TYPE.id, {
          id: 1,
          tags: ["basic", "6-count"],
        }),
      });

      expect(screen.getByText("basic")).toBeOnTheScreen();
      expect(screen.getByText("6-count")).toBeOnTheScreen();
    });
  });
});
