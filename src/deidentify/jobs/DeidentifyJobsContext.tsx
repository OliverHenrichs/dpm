import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { File } from "expo-file-system";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useActivePatternList } from "@/src/pattern/data/components/ActivePatternListContext";
import {
  getPatternListById,
  loadPatterns,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { persistVideo } from "@/src/pattern/data/videoFiles";
import { generateUUID } from "@/src/pattern/types/PatternType";
import { IPattern, IVideoReference } from "@/src/pattern/types/IPatternList";
import {
  DeidentifyProvider,
  DeidentifyRequest,
} from "@/src/deidentify/providers/DeidentifyProvider";
import { Consent, runDeidentify } from "@/src/deidentify/runDeidentify";
import {
  recordReplacement,
  replaceVideoInPattern,
} from "@/src/deidentify/jobs/replaceVideo";

export type JobStatus = "queued" | "running" | "done" | "failed";

export type DeidentifyJob = {
  id: string;
  listId: string;
  patternId: number;
  patternName: string;
  sourceUri: string;
  status: JobStatus;
  /** 0..1 while running. */
  progress: number;
  error?: string;
};

export type StartJob = {
  listId: string;
  patternId: number;
  patternName: string;
  provider: DeidentifyProvider;
  request: DeidentifyRequest;
  consent?: Consent;
};

type JobsContext = {
  jobs: DeidentifyJob[];
  start: (job: StartJob) => void;
  /** Removes finished and failed jobs from the list. */
  dismissFinished: () => void;
};

const Ctx = createContext<JobsContext | null>(null);

const KEEP_AWAKE_TAG = "deidentify";

/**
 * De-identification jobs that outlive the screen that started them: a 30 s clip takes minutes,
 * and the user keeps using the app meanwhile. Jobs run one at a time (the native pipeline
 * holds the GPU), keep the screen awake while any runs, and when one finishes its video
 * *replaces* the source in the pattern — the original stays in the phone's gallery.
 *
 * Replacing goes through the context for the active list, so it merges with whatever the user
 * edited meanwhile; an inactive list cannot be open for editing, so storage is safe there.
 */
export const DeidentifyJobsProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const { activeList, patterns, updatePatterns } = useActivePatternList();
  const [jobs, setJobs] = useState<DeidentifyJob[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());

  // The job runs across many renders; it must see the latest list and patterns, not those of
  // the render that queued it.
  const latest = useRef({ activeList, patterns, updatePatterns });
  useEffect(() => {
    latest.current = { activeList, patterns, updatePatterns };
  }, [activeList, patterns, updatePatterns]);

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

  const patch = (id: string, change: Partial<DeidentifyJob>) =>
    setJobs((all) => all.map((j) => (j.id === id ? { ...j, ...change } : j)));

  const attach = async (
    listId: string,
    patternId: number,
    oldUri: string,
    ref: IVideoReference,
  ) => {
    recordReplacement(oldUri, ref);
    const swap = (list: IPattern[]) =>
      list.map((p) =>
        p.id === patternId ? replaceVideoInPattern(p, oldUri, ref) : p,
      );
    const now = latest.current;
    if (now.activeList?.id === listId) {
      await now.updatePatterns(swap(now.patterns));
    } else {
      await savePatterns(listId, swap(await loadPatterns(listId)));
    }
  };

  const run = async (id: string, job: StartJob) => {
    patch(id, { status: "running" });
    try {
      const list = await getPatternListById(job.listId);
      if (list?.readonly) throw new Error("This list is read-only");
      const outcome = await runDeidentify(
        job.provider,
        job.request,
        ({ fraction }) => patch(id, { progress: fraction }),
        job.consent,
      );
      const stored = await persistVideo(outcome.uri, "deidentified");
      try {
        new File(outcome.uri).delete(); // the cache copy
      } catch {
        // best effort — the cache is the OS's to clear anyway
      }
      await attach(job.listId, job.patternId, job.request.sourceUri, {
        type: "local",
        value: stored,
        generated: { method: job.provider.id, createdAt: Date.now() },
      });
      patch(id, { status: "done", progress: 1 });
    } catch (e) {
      patch(id, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const start = (job: StartJob) => {
    const id = generateUUID();
    setJobs((all) => [
      ...all,
      {
        id,
        listId: job.listId,
        patternId: job.patternId,
        patternName: job.patternName,
        sourceUri: job.request.sourceUri,
        status: "queued",
        progress: 0,
      },
    ]);
    queue.current = queue.current.then(() => run(id, job));
  };

  const dismissFinished = () =>
    setJobs((all) =>
      all.filter((j) => j.status === "queued" || j.status === "running"),
    );

  return (
    <Ctx.Provider value={{ jobs, start, dismissFinished }}>
      {children}
    </Ctx.Provider>
  );
};

/** The jobs context, or null outside its provider (component tests, other hosts). */
export const useOptionalDeidentifyJobs = (): JobsContext | null =>
  useContext(Ctx);

export const useDeidentifyJobs = (): JobsContext => {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useDeidentifyJobs must be used inside DeidentifyJobsProvider",
    );
  return ctx;
};
