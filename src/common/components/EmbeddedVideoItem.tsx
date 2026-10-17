import { FC } from "react";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { embeddedHost } from "@/src/common/utils/videoHosts";
import YouTubeVideoItem from "@/src/common/components/YouTubeVideoItem";
import VimeoVideoItem from "@/src/common/components/VimeoVideoItem";

type EmbeddedVideoItemProps = {
  videoRef: IVideoReference;
  width: number;
  /** Defaults to the 200 the pattern details use. */
  height?: number;
};

/**
 * A link played in its host's own player (YouTube, Vimeo), or nothing for a link that is not
 * one; check `embeddedHost` first.
 */
const EmbeddedVideoItem: FC<EmbeddedVideoItemProps> = (props) => {
  switch (embeddedHost(props.videoRef.value)) {
    case "youtube":
      return <YouTubeVideoItem {...props} />;
    case "vimeo":
      return <VimeoVideoItem {...props} />;
    default:
      return null;
  }
};

export default EmbeddedVideoItem;
