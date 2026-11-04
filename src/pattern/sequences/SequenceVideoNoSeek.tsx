import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import InfoHint from "@/src/common/components/InfoHint";
import { embeddedHost } from "@/src/common/utils/videoHosts";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * Said where _Mark steps_ (or _Loop step_) would be, for a video DPM can play but not seek in:
 * Vimeo's player, and YouTube's on web.
 */
const SequenceVideoNoSeek: React.FC<{
  video: IVideoReference;
  style?: StyleProp<ViewStyle>;
}> = ({ video, style }) => {
  const { t } = useTranslation();
  const vimeo = video.type === "url" && embeddedHost(video.value) === "vimeo";
  return (
    <InfoHint style={style}>
      {t(vimeo ? "sequenceVideoNoSeekVimeo" : "sequenceVideoNoSeek")}
    </InfoHint>
  );
};

export default SequenceVideoNoSeek;
