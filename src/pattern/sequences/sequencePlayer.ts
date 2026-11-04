import type { RefObject } from "react";
import type { IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * What a sequence's screens ask of its video's player, whichever player it is (`expo-video`
 * for files and direct links, YouTube's in a WebView). Only a player that can seek has one.
 */
export interface SequencePlayerHandle {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  /** Where playback is now, in seconds. */
  currentTime: () => Promise<number>;
}

export interface SequencePlayerProps {
  video: IVideoReference;
  playerRef: RefObject<SequencePlayerHandle | null>;
  /** The time, about four times a second while the video plays. */
  onTime: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
}
