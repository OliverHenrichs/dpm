import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import BottomSheet from "@/src/common/components/BottomSheet";
import { AppText, Button } from "@/src/common/ui";
import { AppUpdateModule, isAppUpdateAvailable } from "@/modules/app-update";
import {
  decideUpdatePrompt,
  loadUpdateAsked,
  saveUpdateAsked,
} from "@/src/changelog/appUpdate";
import { useAnonymizeJobs } from "@/src/anonymize/jobs/AnonymizeJobsContext";

/**
 * Google Play's in-app update, flexible flow. Once per launch it asks Play whether a newer
 * version exists; if so, Play's own dialog offers it (at most once a week per version, see
 * `decideUpdatePrompt`), and the download runs in the background while the app is used. When it
 * is downloaded, this sheet offers to restart into it, but only while no video job is queued,
 * running or waiting for review, since the restart would lose it. "Later" asks again at the next
 * launch. Android installs from Play only; absent elsewhere (`isAppUpdateAvailable`). Mounted
 * once, in the root layout.
 */
const UpdatePrompt: React.FC = () => {
  const { t } = useTranslation();
  const { jobs } = useAnonymizeJobs();
  const checked = useRef(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!AppUpdateModule) return;
    const subscription = AppUpdateModule.addListener(
      "onInstallStatus",
      (event) => {
        if (event.status === "downloaded") setDownloaded(true);
      },
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const native = AppUpdateModule;
    if (!native || checked.current) return;
    checked.current = true;
    void (async () => {
      try {
        const [check, asked] = await Promise.all([
          native.check(),
          loadUpdateAsked(),
        ]);
        const decision = decideUpdatePrompt({ check, asked, now: Date.now() });
        if (decision === "restart") {
          setDownloaded(true);
        } else if (decision === "ask") {
          await saveUpdateAsked({
            versionCode: check.availableVersionCode,
            at: Date.now(),
          });
          await native.startFlexibleUpdate();
        }
      } catch {
        // Not installed from Play (a dev client, a sideload), offline, or Play busy: no prompt.
      }
    })();
  }, []);

  if (!isAppUpdateAvailable) return null;

  const busy = jobs.some(
    (job) =>
      job.status === "queued" ||
      job.status === "running" ||
      job.status === "review",
  );

  const restart = () => {
    setRestarting(true);
    AppUpdateModule?.completeUpdate().catch(() => {
      setRestarting(false);
      setDismissed(true);
    });
  };

  return (
    <BottomSheet
      visible={downloaded && !dismissed && !busy}
      onClose={() => setDismissed(true)}
      title={t("updateReadyTitle")}
      minHeight="25%"
    >
      <AppText>{t("updateReadyBody")}</AppText>
      <View style={styles.footer}>
        <Button
          title={t("updateLater")}
          variant="secondary"
          onPress={() => setDismissed(true)}
          style={styles.footerButton}
        />
        <Button
          title={t("updateRestart")}
          onPress={restart}
          disabled={restarting}
          style={styles.footerButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create((theme) => ({
  footer: {
    flexDirection: "row",
    gap: theme.space.md,
    marginTop: theme.space.lg,
  },
  footerButton: { flex: 1 },
}));

export default UpdatePrompt;
