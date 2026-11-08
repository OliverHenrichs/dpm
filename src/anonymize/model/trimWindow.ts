/**
 * The part of a clip that gets anonymized: a window over the source, at most `max` seconds
 * long (the provider's limit — 30 s on-device, 15 s for a service like Viggle) and at least
 * `min`. Pure, so the trim bar's drag arithmetic is testable without rendering.
 */
export type TrimWindow = { start: number; end: number };

export type TrimLimits = { duration: number; min: number; max: number };

/** Whether any window satisfies the limits, i.e. the clip is long enough for the provider. */
export const canTrim = ({ duration, min }: TrimLimits): boolean =>
  duration > 0 && duration >= min;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** The window a new clip starts with: from the beginning, as long as allowed. */
export const initialWindow = ({ duration, max }: TrimLimits): TrimWindow => ({
  start: 0,
  end: Math.min(duration, max),
});

/** Moves the whole window by `delta` seconds, keeping its length, stopping at either end. */
export const moveWindow = (
  window: TrimWindow,
  delta: number,
  { duration }: TrimLimits,
): TrimWindow => {
  const length = window.end - window.start;
  const start = clamp(window.start + delta, 0, duration - length);
  return { start, end: start + length };
};

/** Drags the start handle; the end stays put and the length stays within [min, max]. */
export const resizeStart = (
  window: TrimWindow,
  start: number,
  { min, max }: TrimLimits,
): TrimWindow => ({
  start: clamp(start, Math.max(0, window.end - max), window.end - min),
  end: window.end,
});

/** Drags the end handle; the start stays put and the length stays within [min, max]. */
export const resizeEnd = (
  window: TrimWindow,
  end: number,
  { duration, min, max }: TrimLimits,
): TrimWindow => ({
  start: window.start,
  end: clamp(end, window.start + min, Math.min(duration, window.start + max)),
});

/**
 * Re-fits a window to new limits — switching from the 30 s on-device provider to a 15 s
 * remote one, say. Keeps the start where possible and trims the end; grows a window that is
 * now too short.
 */
export const fitWindow = (
  window: TrimWindow,
  limits: TrimLimits,
): TrimWindow => {
  const { duration, min, max } = limits;
  const length = clamp(window.end - window.start, min, Math.min(max, duration));
  const start = clamp(window.start, 0, duration - length);
  return { start, end: start + length };
};

export type TrimGrab = "start" | "end" | "move";

/**
 * The stretch of the clip the bar spans, in seconds: the whole clip, or a zoomed-in part of it
 * around the selection, so one pixel is a fraction of a second even on a long video.
 */
export type TrimView = { from: number; to: number };

export const fullView = (duration: number): TrimView => ({
  from: 0,
  to: duration,
});

/** Shortest margin a zoomed bar keeps on each side of the selection, in seconds. */
const ZOOM_MARGIN = 2;

/**
 * The zoomed-in view around a selection: the selection with its own length (at least
 * `ZOOM_MARGIN` seconds) to either side, so both handles have room to go either way. Shifted,
 * not cut, where it meets an end of the clip.
 */
export const zoomView = (window: TrimWindow, duration: number): TrimView => {
  const length = window.end - window.start;
  const span = Math.min(duration, length + 2 * Math.max(length, ZOOM_MARGIN));
  const from = clamp(window.start - (span - length) / 2, 0, duration - span);
  return { from, to: from + span };
};

/** Whether zooming in is worth offering: the zoomed bar is at most half the clip. */
export const canZoom = (window: TrimWindow, duration: number): boolean => {
  const { from, to } = zoomView(window, duration);
  return duration > 0 && to - from <= duration / 2;
};

/** Whether the whole selection is on the bar, so both handles can be grabbed. */
export const showsWindow = (view: TrimView, window: TrimWindow): boolean =>
  window.start >= view.from - 1e-6 && window.end <= view.to + 1e-6;

/** Where a moment is on a track `width` pixels wide spanning `view`. */
export const toPixels = (
  seconds: number,
  view: TrimView,
  width: number,
): number => ((seconds - view.from) / (view.to - view.from)) * width;

/**
 * What a touch at `x` pixels on a track `width` pixels wide grabs: a grip if within `grip`
 * pixels of either edge of the window (the nearer one when a short window puts both in
 * reach), the window itself if inside it, nothing otherwise.
 */
export const hitTest = (
  x: number,
  window: TrimWindow,
  width: number,
  view: TrimView,
  grip: number,
): TrimGrab | null => {
  if (width <= 0 || view.to <= view.from) return null;
  const left = toPixels(window.start, view, width);
  const right = toPixels(window.end, view, width);
  const toStart = Math.abs(x - left);
  const toEnd = Math.abs(x - right);
  if (Math.min(toStart, toEnd) <= grip)
    return toStart <= toEnd ? "start" : "end";
  return x > left && x < right ? "move" : null;
};

/** Where a handle shows the clip: the start for a move, since the start is what moves into view. */
export const grabbedTime = (window: TrimWindow, grab: TrimGrab): number =>
  grab === "end" ? window.end : window.start;

/** Applies a drag of `deltaSeconds`, begun on `grab`, to the window as it was at the start. */
export const dragWindow = (
  origin: TrimWindow,
  grab: TrimGrab,
  deltaSeconds: number,
  limits: TrimLimits,
): TrimWindow => {
  switch (grab) {
    case "start":
      return resizeStart(origin, origin.start + deltaSeconds, limits);
    case "end":
      return resizeEnd(origin, origin.end + deltaSeconds, limits);
    case "move":
      return moveWindow(origin, deltaSeconds, limits);
  }
};

/** "1:05" style label for a time in seconds. */
export const formatSeconds = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** "1:05.3" style label, to the tenth of a second, with the language's decimal mark. */
export const formatTenths = (seconds: number, decimal = "."): string => {
  const tenths = Math.max(0, Math.round(seconds * 10));
  const minutes = Math.floor(tenths / 600);
  const rest = tenths % 600;
  const secs = String(Math.floor(rest / 10)).padStart(2, "0");
  return `${minutes}:${secs}${decimal}${rest % 10}`;
};

/**
 * A selection's length for labels and buttons: tenths below 10 s, where a tenth is a visible
 * part of the clip ("1.4"), whole seconds above ("18").
 */
export const formatLength = (seconds: number, decimal = "."): string => {
  if (seconds >= 9.95) return String(Math.round(seconds));
  const tenths = Math.max(0, Math.round(seconds * 10));
  return tenths % 10 === 0
    ? String(tenths / 10)
    : `${Math.floor(tenths / 10)}${decimal}${tenths % 10}`;
};

/**
 * The decimal mark of `language` ("," in German), or "." where its numbers are not written in
 * Latin digits — the labels around it are.
 */
export const decimalMark = (language: string): string => {
  try {
    const mark = /^1(\D)5$/.exec((1.5).toLocaleString(language))?.[1];
    return mark ?? ".";
  } catch {
    return ".";
  }
};
