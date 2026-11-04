import React from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import { AppText, Icon } from "@/src/common/ui";
import { embeddedHost } from "@/src/common/utils/videoHosts";
import { IVideoReference } from "@/src/pattern/types/IPatternList";

/**
 * Said where _Mark steps_ (or _Loop step_) would be, for a video DPM can play but not seek in:
 * Vimeo's player, and YouTube's on web.
 */
const SequenceVideoNoSeek: React.FC<{ video: IVideoReference }> = ({
  video,
}) => {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const vimeo = video.type === "url" && embeddedHost(video.value) === "vimeo";
  return (
    <View style={styles.row}>
      <Icon
        name="information-outline"
        size={theme.iconSize.sm}
        color={theme.colors.textMuted}
      />
      <AppText variant="caption" color="textMuted" style={styles.text}>
        {t(vimeo ? "sequenceVideoNoSeekVimeo" : "sequenceVideoNoSeek")}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.space.xs,
    marginBottom: theme.space.sm,
  },
  text: { flex: 1 },
}));

export default SequenceVideoNoSeek;
