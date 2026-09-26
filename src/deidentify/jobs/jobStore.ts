import { File } from "expo-file-system";
import {
  getPatternListById,
  loadPatterns,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { persistVideo } from "@/src/pattern/data/videoFiles";
import { generateUUID } from "@/src/pattern/types/PatternType";
import { IVideoReference } from "@/src/pattern/types/IPatternList";
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
  /** For the progress line only; the job finds its video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
  status: JobStatus;
  /** 0..1 while running. */
  progress: number;
  error?: string;
};

export type StartJob = {
  listId: string;
  patternName: string;
  provider: DeidentifyProvider;
  request: DeidentifyRequest;
  consent?: Consent;
};

/**
 * Puts a finished video into the list through whoever holds it in memory. Returns false when
 * that is not the list it holds, and the store then writes storage itself.
 */
export type AttachHandler = (
  listId: string,
  oldUri: string,
  ref: IVideoReference,
) => Promise<boolean>;

/**
 * De-identification jobs, held outside React on purpose. Android can destroy the activity while
 * the process — and the native run — carries on; React then mounts a fresh tree. Jobs living in
 * component state were lost with the old tree, while their run kept going and later wrote the
 * old tree's stale pattern snapshot back. Here they survive a remount, the queue stays serial
 * (two pipelines at once do not fit in memory), and the result goes through the handler the
 * *current* tree registered.
 *
 * A job finds its video by URI in every pattern of the list, not by pattern id: a video picked
 * in the form of a pattern that is not saved yet has no pattern to name. If the pattern is saved
 * after the job finished, `applyReplacements` swaps it on the way in.
 */
let jobs: DeidentifyJob[] = [];
const listeners = new Set<() => void>();
let queue: Promise<void> = Promise.resolve();
let attachHandler: AttachHandler | null = null;

const emit = () => listeners.forEach((l) => l());

const patch = (id: string, change: Partial<DeidentifyJob>) => {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...change } : j));
  emit();
};

export const jobStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getJobs: (): DeidentifyJob[] => jobs,

  /** Registers the attach path of the mounted tree; returns the unregister. */
  setAttachHandler(handler: AttachHandler) {
    attachHandler = handler;
    return () => {
      if (attachHandler === handler) attachHandler = null;
    };
  },

  start(job: StartJob): string {
    const id = generateUUID();
    jobs = [
      ...jobs,
      {
        id,
        listId: job.listId,
        patternName: job.patternName,
        sourceUri: job.request.sourceUri,
        status: "queued",
        progress: 0,
      },
    ];
    emit();
    queue = queue.then(() => run(id, job));
    return id;
  },

  /** Removes finished and failed jobs. */
  dismissFinished() {
    jobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
    emit();
  },

  /** Test hook: forget everything, and wait for a running job first. */
  async reset() {
    await queue;
    jobs = [];
    attachHandler = null;
    emit();
  },
};

async function attach(listId: string, oldUri: string, ref: IVideoReference) {
  recordReplacement(oldUri, ref);
  if (attachHandler && (await attachHandler(listId, oldUri, ref))) return;
  const patterns = await loadPatterns(listId);
  const swapped = patterns.map((p) => replaceVideoInPattern(p, oldUri, ref));
  if (swapped.some((p, i) => p !== patterns[i])) {
    await savePatterns(listId, swapped);
  }
}

async function run(id: string, job: StartJob) {
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
    await attach(job.listId, job.request.sourceUri, {
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
}
