import type { VideoPlayer } from "expo-video";

/**
 * How much of a video one player may hold in memory ahead of the playhead. expo-video's Android
 * default lets each player buffer up to ~140 MB, which a 20 Mbit/s phone clip fills in under a
 * minute; the edit form and the Edit video panel each hold a player of the same clip, and two
 * full buffers exhaust the app's 256 MB heap, which kills the app from a MediaCodec thread.
 * Local files read fast, so a few seconds ahead is plenty.
 */
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

/** Apply in every `useVideoPlayer` setup callback. */
export function capVideoBuffer(player: VideoPlayer): void {
  player.bufferOptions = {
    ...player.bufferOptions,
    maxBufferBytes: MAX_BUFFER_BYTES,
  };
}
