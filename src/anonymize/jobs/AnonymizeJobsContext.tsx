import React, {
  PropsWithChildren,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  AnonymizeJob,
  jobStore,
  KeepMode,
  StartJob,
} from "@/src/anonymize/jobs/jobStore";
import { replaceVideoInPattern } from "@/src/anonymize/jobs/replaceVideo";
import {
  askNotificationPermission,
  clearJobsNotification,
  notifyJobsFinished,
  onJobsNotificationOpened,
} from "@/src/anonymize/jobs/jobNotifications";

export type {
  AnonymizeJob,
  JobKind,
  JobStatus,
  KeepMode,
  StartJob,
} from "./jobStore";
export { reviewsSuggestion, writesWithoutCount } from "./jobStore";

const KEEP_AWAKE_TAG = "anonymize";

/**
 * Connects the job store (`jobStore.ts`) to the mounted app: keeps the screen awake while a job
 * runs, and puts a finished video into the active list through the context, so it merges with
 * whatever the user edited meanwhile. Another list is not held in memory; the store writes
 * storage for it.
 */
export const AnonymizeJobsProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const { activeList, patterns, updatePatterns } = useActivePatternList();
  const { jobs } = useAnonymizeJobs();

  // A job finishes many renders after it was queued; attach must see the latest state.
  const latest = useRef({ activeList, patterns, updatePatterns });
  useEffect(() => {
    latest.current = { activeList, patterns, updatePatterns };
  }, [activeList, patterns, updatePatterns]);

  useEffect(
    () =>
      jobStore.setAttachHandler(async (listId, oldUri, update) => {
        const now = latest.current;
        if (now.activeList?.id !== listId) return false;
        await now.updatePatterns(
          now.patterns.map((p) => replaceVideoInPattern(p, oldUri, update)),
        );
        return true;
      }),
    [],
  );

  const running = jobs.some(
    (j) => j.status === "running" || j.status === "queued",
  );
  useEffect(() => {
    if (!running) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running]);

  useFinishedNotification(jobs, running);

  return <>{children}</>;
};

/**
 * Tells the user, with a phone notification, when the jobs they left running have finished
 * while the app was in the background: one notification per batch, not per job, since a cut
 * often queues a transcription ahead of it. The permission is asked for when a batch starts,
 * so the prompt comes with the action it is for. Tapping the notification opens the pattern
 * list, where the banner offers the review; coming back to the app any other way clears it.
 */
function useFinishedNotification(jobs: AnonymizeJob[], running: boolean) {
  const { t } = useTranslation();
  const latest = useRef({ jobs, t });
  /** The jobs of the current batch: everything queued or running since the queue was empty. */
  const batch = useRef(new Set<string>());

  useEffect(() => {
    latest.current = { jobs, t };
    for (const job of jobs) {
      if (job.status === "queued" || job.status === "running") {
        batch.current.add(job.id);
      }
    }
  }, [jobs, t]);

  useEffect(() => {
    const { jobs: now, t: translate } = latest.current;
    if (running) {
      void askNotificationPermission(translate("videoJobsChannel"));
      return;
    }
    const ids = batch.current;
    batch.current = new Set();
    if (AppState.currentState === "active") return;
    // Cancelled jobs leave the list, so a batch the user cancelled entirely notifies nothing.
    const finished = now.filter((j) => ids.has(j.id));
    if (finished.length === 0) return;
    const body = finished.some((j) => j.status === "review")
      ? "videoJobsNotifyReview"
      : finished.some((j) => j.status === "failed")
        ? "videoJobsNotifyFailed"
        : "videoJobsNotifyDone";
    void notifyJobsFinished(translate("videoJobsNotifyTitle"), translate(body));
  }, [running]);

  useEffect(() => {
    const opened = onJobsNotificationOpened(() => router.navigate("/patterns"));
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void clearJobsNotification();
    });
    return () => {
      opened();
      appState.remove();
    };
  }, []);
}

export type JobsApi = {
  jobs: AnonymizeJob[];
  start: (job: StartJob) => void;
  /** Removes finished and failed jobs from the list. */
  dismissFinished: () => void;
  /** Cancels a queued job or a running transcription; see `jobStore.cancel`. */
  cancel: (id: string) => void;
  canCancel: (job: AnonymizeJob) => boolean;
  /** Puts a reviewed result into the pattern; see `jobStore.keep`. */
  keep: (id: string, mode: KeepMode) => Promise<void>;
  /** Throws a reviewed result away. */
  discard: (id: string) => void;
  /** Closes a suggestion's review; see `jobStore.settle`. */
  settle: (id: string) => void;
  /** Takes one finished or failed job off the list. */
  forget: (id: string) => void;
};

/** The jobs, live. Works without the provider; the provider only adds attach and keep-awake. */
export const useAnonymizeJobs = (): JobsApi => {
  const jobs = useSyncExternalStore(
    jobStore.subscribe,
    jobStore.getJobs,
    jobStore.getJobs,
  );
  return {
    jobs,
    start: jobStore.start,
    dismissFinished: jobStore.dismissFinished,
    cancel: jobStore.cancel,
    canCancel: jobStore.canCancel,
    keep: jobStore.keep,
    discard: jobStore.discard,
    settle: jobStore.settle,
    forget: jobStore.forget,
  };
};
