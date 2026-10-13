import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  ScrollView,
  ScrollViewProps,
  View,
  useWindowDimensions,
} from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

/**
 * Scrolls a part of the form to the top of the scroller, above the keyboard, and keeps the room
 * it needs below until `release` is called (or the keyboard closes).
 */
type Reveal = {
  reveal: (target: React.RefObject<View | null>) => void;
  release: () => void;
};

const RevealContext = createContext<Reveal | null>(null);

/**
 * The nearest `RevealScrollView`'s reveal, or no-ops outside one. A field low in a form calls
 * `reveal` on focus with a ref to what should stay in view with it (a search and its results).
 */
export function useReveal(): Reveal {
  return useContext(RevealContext) ?? NO_REVEAL;
}

const NO_REVEAL: Reveal = { reveal: () => {}, release: () => {} };

/** How long to wait for the keyboard before scrolling anyway. */
const KEYBOARD_WAIT_MS = 350;

/**
 * A `ScrollView` whose children can ask to be scrolled into view above the keyboard.
 *
 * A `Modal` on Android draws edge to edge in its own window and does not resize for the
 * keyboard, so a field near the bottom of a form opened under it: the pattern editor's tag
 * search did. On a reveal this scroller adds room below its content (the keyboard's height, or
 * half the window until the keyboard reports one) and scrolls the target to its top.
 */
const RevealScrollView: React.FC<ScrollViewProps> = ({
  children,
  ...props
}) => {
  const { theme } = useUnistyles();
  const { height: windowHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // Measured against, so a target's offset is in content coordinates.
  const contentRef = useRef<View>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const pending = useRef<React.RefObject<View | null> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTo = useCallback(
    (target: React.RefObject<View | null>) => {
      const content = contentRef.current;
      if (!target.current || !content) return;
      target.current.measureLayout(content, (_x, y) => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - theme.space.sm),
          animated: true,
        });
      });
    },
    [theme.space.sm],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const target = pending.current;
    pending.current = null;
    // After the room below has been laid out, so the scroll is not clamped short of it.
    if (target) requestAnimationFrame(() => scrollTo(target));
  }, [scrollTo]);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      flush();
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setRevealing(false);
    });
    return () => {
      shown.remove();
      hidden.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const reveal = useCallback(
    (target: React.RefObject<View | null>) => {
      setRevealing(true);
      pending.current = target;
      if (Keyboard.isVisible()) {
        flush();
      } else {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, KEYBOARD_WAIT_MS);
      }
    },
    [flush],
  );

  const release = useCallback(() => setRevealing(false), []);

  const room = revealing ? keyboardHeight || windowHeight / 2 : 0;

  return (
    <RevealContext.Provider value={{ reveal, release }}>
      <ScrollView ref={scrollRef} {...props}>
        <View ref={contentRef} style={styles.content}>
          {children}
        </View>
        {room > 0 ? <View style={styles.room(room)} /> : null}
      </ScrollView>
    </RevealContext.Provider>
  );
};

// The content grows with the scroller, as a `contentContainerStyle` of `flexGrow: 1` asks.
const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  room: (height: number) => ({ height }),
});

export default RevealScrollView;
