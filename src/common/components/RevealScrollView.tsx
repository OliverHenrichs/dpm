import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Keyboard, ScrollView, ScrollViewProps, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import {
  RevealContext,
  RevealTarget,
  useKeyboardRoom,
  useReveal,
} from "./reveal";

/** How long to wait for the keyboard before scrolling anyway (in a modal, no event says). */
const KEYBOARD_WAIT_MS = 350;

type RevealScrollViewProps = ScrollViewProps & {
  ref?: React.Ref<ScrollView | null>;
};

/**
 * A `ScrollView` that scrolls a focused field (see `reveal.tsx`) to its top, so it sits above
 * the keyboard. It passes the reveal on to its own container (a dialog moves up, a sheet rises),
 * and adds room below its content unless that container already made some.
 */
const RevealScrollView: React.FC<RevealScrollViewProps> = ({
  ref,
  children,
  contentContainerStyle,
  ...props
}) => {
  const { theme } = useUnistyles();
  const parent = useReveal();
  const { room, open, close } = useKeyboardRoom();
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);
  // Measured against, so a target's offset is in content coordinates.
  const contentRef = useRef<View>(null);
  const pending = useRef<RevealTarget | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTo = useCallback(
    (target: RevealTarget) => {
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
    // After the room has been laid out, so the scroll is not clamped short of it.
    if (target) requestAnimationFrame(() => scrollTo(target));
  }, [scrollTo]);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", flush);
    return () => {
      shown.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const reveal = useCallback(
    (target: RevealTarget) => {
      if (!parent.reveal(target)) open();
      pending.current = target;
      if (Keyboard.isVisible()) {
        flush();
      } else {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, KEYBOARD_WAIT_MS);
      }
      return true;
    },
    [parent, open, flush],
  );

  const release = useCallback(() => {
    parent.release();
    close();
  }, [parent, close]);

  return (
    <RevealContext.Provider value={{ reveal, release }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.container}
        {...props}
      >
        {/* The caller's content style goes here, so its padding and gaps lay out the children. */}
        <View ref={contentRef} style={[styles.content, contentContainerStyle]}>
          {children}
        </View>
        {room > 0 ? <View style={styles.room(room)} /> : null}
      </ScrollView>
    </RevealContext.Provider>
  );
};

// The content fills the scroller and grows with it, as a `flexGrow: 1` content style asks.
const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  content: { flexGrow: 1 },
  room: (height: number) => ({ height }),
});

export default RevealScrollView;
