/** How long a manual scroll keeps the transcript from following playback. */
export const MANUAL_SCROLL_PAUSE_MS = 3000;

/** Room left above the line being said when the transcript scrolls to it. */
const LEAD = 24;

type Span = { y: number; height: number };

/**
 * Where to scroll the transcript so the line being said is in view, or null when it already
 * is. A line that is fully visible stays put, so the text only moves when playback leaves the
 * window, and then the line lands near the top with the next ones below it.
 */
export function followScrollTarget(
  line: Span,
  viewport: Span,
  contentHeight: number,
): number | null {
  const visible =
    line.y >= viewport.y &&
    line.y + line.height <= viewport.y + viewport.height;
  if (visible) return null;
  const maxY = Math.max(0, contentHeight - viewport.height);
  return Math.min(maxY, Math.max(0, line.y - LEAD));
}
