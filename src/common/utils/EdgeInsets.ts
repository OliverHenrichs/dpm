/**
 * How far in from a screen edge app content has to start.
 *
 * Android 10+ binds the system back gesture to both screen edges and consumes
 * roughly the outer 20 dp of each. Anything horizontally scrollable that
 * reaches into that band competes with it, and the result is a swipe that
 * sometimes scrolls and sometimes goes back — the timeline's scroller, the
 * graph's pan, and the video carousel all qualify.
 *
 * Keeping content out of the band is the free half of the fix. The other half
 * is `View.setSystemGestureExclusionRects`, which hands the band back to the
 * app; React Native exposes no JS API for it, so it would need a native
 * module, and it only works on Android 10+ (see AGENT_TASKS.md M1).
 *
 * Applied once, on `PageContainer`, so every screen inherits it rather than
 * each scroller remembering to pad itself.
 */
export const SCREEN_EDGE_INSET = 16;
