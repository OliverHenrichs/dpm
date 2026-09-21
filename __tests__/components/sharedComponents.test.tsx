import React from "react";
import { Text } from "react-native";
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
  const renderCarousel = (videoRefs: IVideoReference[]) =>
    renderWithProviders(
      <VideoCarousel videoRefs={videoRefs} palette={palette} />,
      { activeListId: null },
    );

  it("shows no pager for a single video", () => {
    renderCarousel([urlVideo("https://example.com/a.mp4")]);

    expect(screen.queryByText("1 / 1")).toBeNull();
  });

  it("pages when there is more than one", () => {
    renderCarousel([
      urlVideo("https://example.com/a.mp4"),
      urlVideo("https://example.com/b.mp4"),
    ]);

    expect(screen.getByText("1 / 2")).toBeOnTheScreen();
  });

  it("copes with no videos at all", () => {
    renderCarousel([]);

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
