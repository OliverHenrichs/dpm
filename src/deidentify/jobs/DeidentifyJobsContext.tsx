import React, {
  PropsWithChildren,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  DeidentifyJob,
  jobStore,
  KeepMode,
  StartJob,
} from "@/src/deidentify/jobs/jobStore";
import { replaceVideoInPattern } from "@/src/deidentify/jobs/replaceVideo";

export type {
  DeidentifyJob,
  JobKind,
  JobStatus,
  KeepMode,
  StartJob,
} from "./jobStore";

const KEEP_AWAKE_TAG = "deidentify";

/**
 * Connects the job store (`jobStore.ts`) to the mounted app: keeps the screen awake while a job
 * runs, and puts a finished video into the active list through the context, so it merges with
 * whatever the user edited meanwhile. Another list is not held in memory; the store writes
 * storage for it.
 */
export const DeidentifyJobsProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const { activeList, patterns, updatePatterns } = useActivePatternList();
  const { jobs } = useDeidentifyJobs();

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

  return <>{children}</>;
};

export type JobsApi = {
  jobs: DeidentifyJob[];
  start: (job: StartJob) => void;
  /** Removes finished and failed jobs from the list. */
  dismissFinished: () => void;
  /** Cancels a queued job or a running transcription; see `jobStore.cancel`. */
  cancel: (id: string) => void;
  canCancel: (job: DeidentifyJob) => boolean;
  /** Puts a reviewed result into the pattern; see `jobStore.keep`. */
  keep: (id: string, mode: KeepMode) => Promise<void>;
  /** Throws a reviewed result away. */
  discard: (id: string) => void;
};

/** The jobs, live. Works without the provider; the provider only adds attach and keep-awake. */
export const useDeidentifyJobs = (): JobsApi => {
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
  };
};
