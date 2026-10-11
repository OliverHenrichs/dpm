import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { AppText, Button } from "@/src/common/ui";
import ChangelogEntries from "@/src/changelog/components/ChangelogEntries";
import {
  CHANGELOG,
  ChangelogEntry,
  decideWhatsNew,
} from "@/src/changelog/changelog";
import {
  loadSeenVersion,
  loadWhatsNewEnabled,
  saveSeenVersion,
} from "@/src/changelog/ChangelogStorage";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";

/**
 * After an update, a sheet with what changed since the version the user last saw. Decided once
 * per launch, after the lists have loaded (whether there are any tells an update from a first
 * install); see `decideWhatsNew`. Mounted once, in the root layout.
 */
const WhatsNewHint: React.FC = () => {
  const { t } = useTranslation();
  const { isLoading, hasLists } = useActivePatternList();
  // Once per launch: a later reload of the lists must not ask again.
  const checked = useRef(false);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [markSeen, setMarkSeen] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (isLoading || checked.current) return;
    checked.current = true;
    void (async () => {
      const [seenVersion, hintEnabled] = await Promise.all([
        loadSeenVersion(),
        loadWhatsNewEnabled(),
      ]);
      const decision = decideWhatsNew({
        entries: CHANGELOG,
        seenVersion,
        hintEnabled,
        hasExistingData: hasLists,
      });
      if (decision.show.length > 0) {
        setEntries(decision.show);
        setMarkSeen(decision.markSeen);
        setVisible(true);
      } else if (decision.markSeen) {
        await saveSeenVersion(decision.markSeen);
      }
    })();
  }, [isLoading, hasLists]);

  const close = () => {
    setVisible(false);
    if (markSeen) void saveSeenVersion(markSeen);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title={
        entries.length === 1 && !showAll
          ? t("whatsNewInVersion", { version: entries[0].version })
          : t("whatsNew")
      }
      minHeight="30%"
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ChangelogEntries entries={showAll ? CHANGELOG : entries} />
      </ScrollView>
      <AppText variant="caption" color="textMuted" style={styles.hint}>
        {t("whatsNewTurnOffHint")}
      </AppText>
      <View style={styles.footer}>
        {!showAll && entries.length < CHANGELOG.length && (
          <Button
            title={t("changelogShowAll")}
            variant="secondary"
            onPress={() => setShowAll(true)}
            style={styles.footerButton}
          />
        )}
        <Button
          title={t("whatsNewGotIt")}
          onPress={close}
          style={styles.footerButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  content: { paddingBottom: theme.space.md },
  hint: { marginTop: theme.space.sm },
  footer: {
    flexDirection: "row",
    gap: theme.space.md,
    marginTop: theme.space.md,
  },
  footerButton: { flex: 1 },
}));

export default WhatsNewHint;
