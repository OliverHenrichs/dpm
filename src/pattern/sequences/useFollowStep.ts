import { RefObject, useEffect, useRef } from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import {
  followScrollTarget,
  MANUAL_SCROLL_PAUSE_MS,
} from "@/src/transcribe/followScroll";

type Span = { y: number; height: number };

/**
 * Keeps the step playing in view while the video plays, as the transcript sheet follows the
 * line being said (`followScroll.ts`): the list moves only when the step leaves the window, and
 * not for a few seconds after the user scrolled it themselves.
 */
export function useFollowStep(
  scrollRef: RefObject<ScrollView | null>,
  current: number,
  playing: boolean,
) {
  const rows = useRef(new Map<number, Span>());
  /** Where the rows' box starts within the scroller's content. */
  const rowsTop = useRef(0);
  const viewport = useRef({ y: 0, height: 0, contentHeight: 0 });
  const manualUntil = useRef(0);

  useEffect(() => {
    if (!playing || current < 0 || Date.now() < manualUntil.current) return;
    const row = rows.current.get(current);
    if (!row) return;
    const { contentHeight, ...view } = viewport.current;
    const y = followScrollTarget(
      { y: rowsTop.current + row.y, height: row.height },
      view,
      contentHeight,
    );
    if (y !== null) scrollRef.current?.scrollTo({ y, animated: true });
  }, [scrollRef, current, playing]);

  const pause = () => {
    manualUntil.current = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  };

  return {
    /** Spread on the scroller `scrollRef` holds. */
    scrollProps: {
      scrollEventThrottle: 100,
      onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        viewport.current.y = e.nativeEvent.contentOffset.y;
      },
      onLayout: (e: LayoutChangeEvent) => {
        viewport.current.height = e.nativeEvent.layout.height;
      },
      onContentSizeChange: (_: number, height: number) => {
        viewport.current.contentHeight = height;
      },
      onScrollBeginDrag: pause,
      onScrollEndDrag: pause,
      onMomentumScrollEnd: pause,
    },
    /** On the box holding the rows, a child of the scroller's first child (at its top). */
    onRowsLayout: (e: LayoutChangeEvent) => {
      rowsTop.current = e.nativeEvent.layout.y;
    },
    onRowLayout: (index: number) => (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      rows.current.set(index, { y, height });
    },
  };
}
