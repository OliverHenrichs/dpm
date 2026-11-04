import React, {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";
import { extractYouTubeVideoId } from "@/src/common/utils/YouTubeUtils";
import type { SequencePlayerProps } from "@/src/pattern/sequences/sequencePlayer";

/** Whether a YouTube link can be marked and sought in on this platform. */
export const YOUTUBE_SEEKS = true;

/** How often the time is read while the video plays: four times a second is enough to follow. */
export const YOUTUBE_POLL_MS = 250;

/**
 * A sequence's YouTube video, in `react-native-youtube-iframe`'s player. Its ref reads and sets
 * the time; the time is polled only while the video plays, since reading it is a message to
 * the WebView and back.
 */
const SequenceYouTubePlayer: React.FC<
  SequencePlayerProps & { width: number; height: number }
> = ({ video, width, height, playerRef, onTime, onPlayingChange, onEnded }) => {
  const iframe = useRef<YoutubeIframeRef | null>(null);
  const [playing, setPlaying] = useState(false);

  const report = useEffectEvent((seconds: number) => onTime(seconds));
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      iframe.current?.getCurrentTime().then(
        (seconds) => report(seconds),
        () => {},
      );
    }, YOUTUBE_POLL_MS);
    return () => clearInterval(timer);
  }, [playing]);

  useImperativeHandle(
    playerRef,
    () => ({
      seekTo: (seconds) => iframe.current?.seekTo(seconds, true),
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      currentTime: async () => (await iframe.current?.getCurrentTime()) ?? 0,
    }),
    [],
  );

  return (
    <YoutubePlayer
      ref={iframe}
      height={height}
      width={width}
      videoId={extractYouTubeVideoId(video.value) ?? ""}
      play={playing}
      initialPlayerParams={
        video.startTime != null ? { start: video.startTime } : undefined
      }
      onChangeState={(state: string) => {
        // The player's own controls play and pause it too: `play` follows them.
        const nowPlaying = state === "playing";
        if (state === "playing" || state === "paused" || state === "ended") {
          setPlaying(nowPlaying);
          onPlayingChange(nowPlaying);
        }
        if (state === "ended") onEnded();
      }}
    />
  );
};

export default SequenceYouTubePlayer;
