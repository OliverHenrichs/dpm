import React, { useRef } from "react";
import { Keyboard, ScrollView, TextInput, View } from "react-native";
import RevealScrollView, {
  useReveal,
} from "@/src/common/components/RevealScrollView";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

/** A field low in a form that asks to stay in view while focused, as the pattern pickers do. */
/** Host views have no layout under Jest: the target reports it sits 400 below the content's top. */
function placeAt400(node: View | null) {
  if (node)
    (node as unknown as { measureLayout: unknown }).measureLayout = (
      _relative: unknown,
      onSuccess: (x: number, y: number) => void,
    ) => onSuccess(0, 400);
}

function LowField() {
  const ref = useRef<View>(null);
  const { reveal, release } = useReveal();
  return (
    <View
      ref={(node) => {
        placeAt400(node);
        ref.current = node;
      }}
    >
      <TextInput
        placeholder="search"
        onFocus={() => reveal(ref)}
        onBlur={release}
      />
    </View>
  );
}

describe("RevealScrollView", () => {
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    scrollTo = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function renderField() {
    renderWithProviders(
      <RevealScrollView testID="scroller">
        <LowField />
      </RevealScrollView>,
      { activeListId: null },
    );
  }

  /** The room kept below the content: the scroller's last child, when it has one. */
  const roomCount = () =>
    screen
      .getByTestId("scroller")
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.style?.height !== undefined,
      ).length;

  it("scrolls the field to the top once the keyboard has had time to open", () => {
    renderField();

    fireEvent(screen.getByPlaceholderText("search"), "focus");
    act(() => {
      jest.runAllTimers();
    });

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ y: expect.any(Number) }),
    );
    expect(scrollTo.mock.calls.at(-1)![0].y).toBeLessThan(400);
    expect(scrollTo.mock.calls.at(-1)![0].y).toBeGreaterThan(350);
  });

  it("scrolls at once when the keyboard is already open", () => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
    renderField();

    fireEvent(screen.getByPlaceholderText("search"), "focus");
    act(() => {
      // A frame, well short of the wait for a keyboard that has not opened.
      jest.advanceTimersByTime(50);
    });

    expect(scrollTo).toHaveBeenCalled();
  });

  it("keeps room below while the field is focused, and gives it back on blur", () => {
    renderField();
    const before = roomCount();

    fireEvent(screen.getByPlaceholderText("search"), "focus");
    expect(roomCount()).toBe(before + 1);

    fireEvent(screen.getByPlaceholderText("search"), "blur");
    expect(roomCount()).toBe(before);
  });

  it("does nothing outside a RevealScrollView", () => {
    renderWithProviders(<LowField />, { activeListId: null });

    expect(() =>
      fireEvent(screen.getByPlaceholderText("search"), "focus"),
    ).not.toThrow();
  });
});
