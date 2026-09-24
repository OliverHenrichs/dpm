/**
 * The part of a clip that gets de-identified: a window over the source, at most `max` seconds
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
 * What a touch at `x` pixels on a track `width` pixels wide grabs: a grip if within `grip`
 * pixels of either edge of the window (the nearer one when a short window puts both in
 * reach), the window itself if inside it, nothing otherwise.
 */
export const hitTest = (
  x: number,
  window: TrimWindow,
  width: number,
  duration: number,
  grip: number,
): TrimGrab | null => {
  if (width <= 0 || duration <= 0) return null;
  const left = (window.start / duration) * width;
  const right = (window.end / duration) * width;
  const toStart = Math.abs(x - left);
  const toEnd = Math.abs(x - right);
  if (Math.min(toStart, toEnd) <= grip)
    return toStart <= toEnd ? "start" : "end";
  return x > left && x < right ? "move" : null;
};

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
