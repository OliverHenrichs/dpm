import React, { useRef } from "react";
import { Keyboard, ScrollView, TextInput, View } from "react-native";
import RevealScrollView from "@/src/common/components/RevealScrollView";
import ModalOverlay from "@/src/common/components/ModalOverlay";
import BottomSheet from "@/src/common/components/BottomSheet";
import { RevealTextInput } from "@/src/common/components/reveal";
import {
  act,
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

/** Host views have no layout under Jest: the target reports it sits 400 below the content's top. */
function placeAt400(node: View | null) {
  if (node)
    (node as unknown as { measureLayout: unknown }).measureLayout = (
      _relative: unknown,
      onSuccess: (x: number, y: number) => void,
    ) => onSuccess(0, 400);
}

/** A search with results below it, kept in view together, as the pattern pickers do. */
function LowField() {
  const ref = useRef<View>(null);
  return (
    <View
      ref={(node) => {
        placeAt400(node);
        ref.current = node;
      }}
    >
      <RevealTextInput placeholder="search" revealRef={ref} />
    </View>
  );
}

const field = () => screen.getByPlaceholderText("search");
const focus = () => fireEvent(field(), "focus");
const blur = () =>
  act(() => {
    fireEvent(field(), "blur");
    jest.runOnlyPendingTimers();
  });

/** The views that keep room below content: the only host views given a bare numeric height. */
const roomCount = () =>
  screen.root.findAll(
    (node) =>
      typeof node.type === "string" &&
      typeof node.props.style?.height === "number" &&
      Object.keys(node.props.style).length <= 2,
  ).length;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("RevealScrollView", () => {
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    scrollTo = jest
      .spyOn(ScrollView.prototype, "scrollTo")
      .mockImplementation(() => {});
  });

  function renderField() {
    renderWithProviders(
      <RevealScrollView>
        <LowField />
      </RevealScrollView>,
      { activeListId: null },
    );
  }

  it("scrolls the field to the top once the keyboard has had time to open", () => {
    renderField();

    focus();
    act(() => {
      jest.runAllTimers();
    });

    const { y } = scrollTo.mock.calls.at(-1)![0];
    expect(y).toBeLessThan(400);
    expect(y).toBeGreaterThan(350);
  });

  it("scrolls at once when the keyboard is already open", () => {
    jest.spyOn(Keyboard, "isVisible").mockReturnValue(true);
    renderField();

    focus();
    act(() => {
      // A frame, well short of the wait for a keyboard that has not opened.
      jest.advanceTimersByTime(50);
    });

    expect(scrollTo).toHaveBeenCalled();
  });

  it("keeps room below while the field is focused, and gives it back on blur", () => {
    renderField();
    const before = roomCount();

    focus();
    expect(roomCount()).toBe(before + 1);

    blur();
    expect(roomCount()).toBe(before);
  });

  it("keeps the room when focus moves straight to another field", () => {
    renderWithProviders(
      <RevealScrollView>
        <RevealTextInput placeholder="first" />
        <RevealTextInput placeholder="second" />
      </RevealScrollView>,
      { activeListId: null },
    );
    const before = roomCount();

    fireEvent(screen.getByPlaceholderText("first"), "focus");
    fireEvent(screen.getByPlaceholderText("first"), "blur");
    fireEvent(screen.getByPlaceholderText("second"), "focus");
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(roomCount()).toBe(before + 1);
  });

  it("forwards its ref to the scroller", () => {
    const ref = React.createRef<ScrollView>();
    renderWithProviders(
      <RevealScrollView ref={ref}>
        <View />
      </RevealScrollView>,
      { activeListId: null },
    );

    expect(ref.current?.scrollTo).toBeDefined();
  });
});

describe("RevealTextInput", () => {
  it("works outside any container", () => {
    renderWithProviders(<RevealTextInput placeholder="search" />, {
      activeListId: null,
    });

    expect(() => focus()).not.toThrow();
  });

  it("still calls its own focus and blur handlers, and forwards its ref", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const ref = React.createRef<TextInput>();
    renderWithProviders(
      <RevealTextInput
        ref={ref}
        placeholder="search"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
      { activeListId: null },
    );

    focus();
    blur();

    expect(onFocus).toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalled();
    expect(ref.current).not.toBeNull();
  });
});

describe("ModalOverlay", () => {
  function renderDialog(align?: "center" | "bottom") {
    renderWithProviders(
      <ModalOverlay align={align}>
        <RevealTextInput placeholder="search" />
      </ModalOverlay>,
      { activeListId: null },
    );
  }

  /** Where the overlay puts its content: the one view here that justifies its children. */
  const placement = () => {
    const [overlay] = screen.root.findAll(
      (node) =>
        typeof node.type === "string" &&
        [node.props.style]
          .flat(Infinity)
          .some((style) => style?.justifyContent !== undefined),
    );
    return Object.assign({}, ...[overlay.props.style].flat(Infinity))
      .justifyContent;
  };

  it("moves a centred dialog to the top while a field has focus", () => {
    renderDialog();
    expect(placement()).toBe("center");

    focus();
    expect(placement()).toBe("flex-start");

    blur();
    expect(placement()).toBe("center");
  });

  it("leaves a bottom panel where it is", () => {
    renderDialog("bottom");

    focus();

    expect(placement()).toBe("flex-end");
  });
});

describe("BottomSheet", () => {
  it("grows by the keyboard's room while a field in it has focus", () => {
    renderWithProviders(
      <BottomSheet visible onClose={() => {}} title="Sheet">
        <RevealTextInput placeholder="search" />
      </BottomSheet>,
      { activeListId: null },
    );
    const before = roomCount();

    focus();
    expect(roomCount()).toBe(before + 1);

    blur();
    expect(roomCount()).toBe(before);
  });
});
