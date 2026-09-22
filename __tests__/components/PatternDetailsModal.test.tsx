import React from "react";
import { ScrollView, View } from "react-native";
import PatternDetailsModal from "@/src/pattern/graph/PatternDetailsModal";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const TYPE = createTestPatternType({ slug: "push" });

const pattern = (overrides: Partial<IPattern> = {}) =>
  createTestPattern(TYPE.id, {
    id: 1,
    name: "Sugar Push",
    counts: 6,
    ...overrides,
  });

function renderModal(overrides: Partial<IPattern> = {}) {
  const onClose = jest.fn();
  const subject = pattern(overrides);
  renderWithProviders(
    <PatternDetailsModal
      visible
      pattern={subject}
      allPatterns={[subject]}
      patternTypes={[TYPE]}
      modifiers={[]}
      onClose={onClose}
    />,
  );
  return { onClose, subject };
}

/** Flatten a style prop, which may be an array, into one object. */
const flatten = (style: unknown): Record<string, unknown> =>
  (Array.isArray(style) ? style.flat(Infinity) : [style])
    .filter(Boolean)
    .reduce<Record<string, unknown>>(
      (merged, part) => ({ ...merged, ...(part as object) }),
      {},
    );

describe("PatternDetailsModal", () => {
  describe("what it shows", () => {
    it("names the pattern", () => {
      renderModal();

      expect(screen.getByText("Sugar Push")).toBeOnTheScreen();
    });

    it("shows its details", () => {
      renderModal({ counts: 8 });

      expect(screen.getByText("8")).toBeOnTheScreen();
    });
  });

  describe("its size", () => {
    /**
     * React Native puts `flexGrow: 1` on a ScrollView's content container, so
     * left alone the card fills its whole allowance — the full 80% of the
     * screen — however little is in it. Both have to be zero for a short
     * pattern to get a short card.
     */
    it("lets the scroll view shrink to its content", () => {
      renderModal();

      const scroll = screen.UNSAFE_getByType(ScrollView);
      expect(flatten(scroll.props.style).flexGrow).toBe(0);
    });

    it("lets the content container shrink too", () => {
      renderModal();

      const scroll = screen.UNSAFE_getByType(ScrollView);
      expect(flatten(scroll.props.contentContainerStyle).flexGrow).toBe(0);
    });

    it("keeps a ceiling, so a long pattern still scrolls", () => {
      renderModal();

      // Walk up from the title to the card that carries the cap.
      const styles: Record<string, unknown>[] = [];
      for (let node = screen.getByText("Sugar Push").parent; node;) {
        styles.push(flatten(node.props.style));
        node = node.parent;
      }

      expect(styles.some((style) => style.maxHeight === "80%")).toBe(true);
    });
  });

  describe("what it leaves out", () => {
    it("shows no tag row when the pattern has none", () => {
      // A bare "Tags:" with a blank after it is just height.
      renderModal({ tags: [] });

      expect(screen.queryByText("Tags: ")).toBeNull();
    });

    it("shows the tag row when there are tags", () => {
      renderModal({ tags: ["swingout"] });

      expect(screen.getByText("swingout")).toBeOnTheScreen();
    });

    it("still says when nothing comes before the pattern", () => {
      // Unlike tags, that answers a question someone opened a graph detail
      // view to ask, so it stays even when empty.
      renderModal({ prerequisites: [] });

      expect(screen.getByText("None (foundational pattern)")).toBeOnTheScreen();
    });

    it("draws one rule under the title, not two", () => {
      // The modal header already has one; the details' own top border made a
      // second, a hairline below it.
      renderModal();

      const separators = screen
        .UNSAFE_getAllByType(View)
        .filter((node) => flatten(node.props.style).borderTopWidth === 1);
      expect(separators).toHaveLength(0);
    });
  });

  describe("dismissing it", () => {
    it("closes on the X", () => {
      const { onClose } = renderModal();

      fireEvent.press(screen.getByLabelText("Close"));

      expect(onClose).toHaveBeenCalled();
    });

    it("closes on a tap outside the card", () => {
      const { onClose } = renderModal();

      fireEvent.press(screen.getByLabelText("Dismiss details"));

      expect(onClose).toHaveBeenCalled();
    });

    it("stays open on a tap on the card itself", () => {
      const { onClose } = renderModal();

      fireEvent.press(screen.getByText("Sugar Push"));

      expect(onClose).not.toHaveBeenCalled();
    });

    /**
     * The backdrop is a sibling behind the card, never a wrapper around it.
     * A wrapping press handler — even one that only swallows the event —
     * claims the touch, and native children never receive it: the video
     * player's controls stopped responding inside this modal while the same
     * details rendered in a list row were fine.
     */
    it("puts no press handler between the card and its content", () => {
      renderModal();

      const handlers: unknown[] = [];
      for (let node = screen.getByText("Sugar Push").parent; node;) {
        handlers.push(node.props.onPress);
        node = node.parent;
      }

      expect(handlers.every((handler) => handler === undefined)).toBe(true);
    });
  });
});
