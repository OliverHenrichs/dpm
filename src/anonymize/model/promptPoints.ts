/**
 * Mapping taps on a preview to points in the video, for providers that track from a prompt
 * (one tap per dancer on the first frame). The preview shows the video `contain`-fitted, so a
 * tap in a letterbox bar is not on the video at all. Points are normalised (0..1) so they do
 * not depend on the resolution the provider works at.
 */
export type Size = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = Point & Size;

/** Where a `contain`-fitted video sits inside a view. */
export const containRect = (view: Size, video: Size): Rect => {
  if (
    view.width <= 0 ||
    view.height <= 0 ||
    video.width <= 0 ||
    video.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(view.width / video.width, view.height / video.height);
  const width = video.width * scale;
  const height = video.height * scale;
  return {
    x: (view.width - width) / 2,
    y: (view.height - height) / 2,
    width,
    height,
  };
};

/** A tap in view coordinates as a normalised video point, or null if it missed the video. */
export const tapToVideoPoint = (
  tap: Point,
  view: Size,
  video: Size,
): Point | null => {
  const r = containRect(view, video);
  if (r.width === 0) return null;
  const x = (tap.x - r.x) / r.width;
  const y = (tap.y - r.y) / r.height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
};

/** A normalised video point back in view coordinates, for drawing a marker. */
export const videoPointToView = (
  point: Point,
  view: Size,
  video: Size,
): Point => {
  const r = containRect(view, video);
  return { x: r.x + point.x * r.width, y: r.y + point.y * r.height };
};
