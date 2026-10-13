import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  TextInput,
  TextInputProps,
  View,
  useWindowDimensions,
} from "react-native";

/*
 * Keeping a focused field above the keyboard.
 *
 * Android draws a `Modal` edge to edge in its own window, which does not resize for the keyboard,
 * and React Native's keyboard events come only from the main window, so inside a modal nothing
 * says the keyboard opened or how tall it is. A field low in a modal form therefore opened under
 * the keyboard. Instead, a field says when it gains and loses focus (`RevealTextInput` does), and
 * the nearest container makes room: `RevealScrollView` scrolls the field to its top, `ModalOverlay`
 * moves a centred dialog to the top, `BottomSheet` raises the sheet. The room is the keyboard's
 * height when an event reports one, and otherwise half the window, which clears a phone keyboard.
 */

/** Something whose position in a container can be measured: a view or a text field. */
export type RevealTarget = React.RefObject<Pick<View, "measureLayout"> | null>;

export type Reveal = {
  /**
   * Keep `target` in view above the keyboard. Returns whether this container made room below
   * the content itself, so a scroller inside it need not add its own.
   */
  reveal: (target: RevealTarget) => boolean;
  /** The field lost focus: give the room back. */
  release: () => void;
};

export const RevealContext = createContext<Reveal | null>(null);

const NO_REVEAL: Reveal = { reveal: () => false, release: () => {} };

/** The nearest container's reveal, or no-ops outside one. */
export function useReveal(): Reveal {
  return useContext(RevealContext) ?? NO_REVEAL;
}

/**
 * How long room outlives a blur. Moving from one field to the next blurs before it focuses, and
 * the form should not jump down and up in between.
 */
const RELEASE_DELAY_MS = 150;

/**
 * The room a container keeps below its content while a field in it has focus: the keyboard's
 * height when an event reports one, half the window otherwise, nothing without a focused field.
 */
export function useKeyboardRoom() {
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [active, setActive] = useState(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRelease = () => {
    if (releaseTimer.current) clearTimeout(releaseTimer.current);
    releaseTimer.current = null;
  };

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setActive(false);
    });
    return () => {
      shown.remove();
      hidden.remove();
      cancelRelease();
    };
  }, []);

  const open = useCallback(() => {
    cancelRelease();
    setActive(true);
  }, []);

  const close = useCallback(() => {
    cancelRelease();
    releaseTimer.current = setTimeout(() => setActive(false), RELEASE_DELAY_MS);
  }, []);

  return {
    active,
    room: active ? keyboardHeight || windowHeight / 2 : 0,
    open,
    close,
  };
}

type RevealTextInputProps = TextInputProps & {
  ref?: React.Ref<TextInput | null>;
  /** What to keep in view with the field, such as a search and its results; the field alone if unset. */
  revealRef?: RevealTarget;
};

/**
 * A `TextInput` that keeps itself (or `revealRef`) above the keyboard while it has focus. Use it
 * for every field in a modal, sheet or scrolling form.
 */
export function RevealTextInput({
  ref,
  revealRef,
  onFocus,
  onBlur,
  ...props
}: RevealTextInputProps) {
  const own = useRef<TextInput>(null);
  useImperativeHandle(ref, () => own.current as TextInput);
  const { reveal, release } = useReveal();
  return (
    <TextInput
      ref={own}
      onFocus={(e) => {
        reveal(revealRef ?? own);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        release();
        onBlur?.(e);
      }}
      {...props}
    />
  );
}
