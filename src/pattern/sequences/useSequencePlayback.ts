import { useRef, useState } from "react";
import { ISequenceStep } from "@/src/pattern/types/IPatternList";
import { loopWindow, stepAtTime } from "@/src/pattern/sequences/sequences";
import type {
  SequencePlayerHandle,
  SequencePlayerProps,
} from "@/src/pattern/sequences/sequencePlayer";

export interface SequencePlayback {
  /** For `SequenceVideo`: the handle and the events it reports. */
  player: Omit<SequencePlayerProps, "video">;
  playing: boolean;
  /** The step playing: the one whose mark is the latest passed, or -1. */
  current: number;
  /** The step _Loop step_ repeats, by id, or null when it is off. */
  loopId: string | null;
  /** Plays the step at `index` from its mark; a loop moves to it. */
  playStep: (index: number) => void;
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  /** Loops the step playing (or the first marked one), or stops looping. */
  toggleLoop: () => void;
  /** Where playback is now, read from the player: what a mark stores. */
  currentTime: () => Promise<number>;
}

/**
 * The steps following the sequence's video: which one is playing, seeking to a step, and
 * _Loop step_, which jumps back to the step's mark when playback reaches the next mark (or the
 * video's end).
 */
export function useSequencePlayback(
  steps: readonly ISequenceStep[],
): SequencePlayback {
  const playerRef = useRef<SequencePlayerHandle | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loopId, setLoopId] = useState<string | null>(null);

  const loopIndex = loopId ? steps.findIndex((s) => s.id === loopId) : -1;
  const loop = loopIndex >= 0 ? loopWindow(steps, loopIndex) : null;

  const seekTo = (seconds: number) => {
    playerRef.current?.seekTo(seconds);
    setTime(seconds);
  };
  const play = () => playerRef.current?.play();
  const pause = () => playerRef.current?.pause();

  const onTime = (seconds: number) => {
    if (loop?.end !== undefined && seconds >= loop.end) {
      seekTo(loop.start);
      return;
    }
    setTime(seconds);
  };
  const onEnded = () => {
    if (!loop) return;
    seekTo(loop.start);
    play();
  };

  const playStep = (index: number) => {
    const step = steps[index];
    if (step?.at === undefined) return;
    seekTo(step.at);
    play();
    if (loopId) setLoopId(step.id);
  };

  const current = stepAtTime(steps, time);
  const toggleLoop = () => {
    if (loopId) {
      setLoopId(null);
      return;
    }
    const index =
      current >= 0 ? current : steps.findIndex((s) => s.at !== undefined);
    if (index >= 0) setLoopId(steps[index].id);
  };

  const currentTime = async () =>
    (await playerRef.current?.currentTime()) ?? time;

  return {
    player: { playerRef, onTime, onPlayingChange: setPlaying, onEnded },
    playing,
    current,
    loopId: loopIndex >= 0 ? loopId : null,
    playStep,
    seekTo,
    play,
    pause,
    toggleLoop,
    currentTime,
  };
}
