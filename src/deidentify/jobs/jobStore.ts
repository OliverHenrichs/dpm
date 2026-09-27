import { File } from "expo-file-system";
import {
  getPatternListById,
  loadPatterns,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { persistVideo } from "@/src/pattern/data/videoFiles";
import { generateUUID } from "@/src/pattern/types/PatternType";
import { IGeneratedVideo } from "@/src/pattern/types/IPatternList";
import { shortenVideo, TrimRequest } from "@/src/deidentify/shortenVideo";
import {
  DeidentifyProvider,
  DeidentifyRequest,
} from "@/src/deidentify/providers/DeidentifyProvider";
import { Consent, runDeidentify } from "@/src/deidentify/runDeidentify";
import {
  recordReplacement,
  replaceVideoInPattern,
  VideoUpdate,
} from "@/src/deidentify/jobs/replaceVideo";
import { transcribeVideo } from "@/src/transcribe/transcribeVideo";

export type JobStatus = "queued" | "running" | "done" | "failed";

export type JobKind = "deidentify" | "shorten" | "transcribe";

export type DeidentifyJob = {
  id: string;
  kind: JobKind;
  listId: string;
  /** For the progress line only; the job finds its video by [sourceUri]. */
  patternName: string;
  sourceUri: string;
  status: JobStatus;
  /** 0..1 while running. */
  progress: number;
  /** The video that replaced the source, once done — how the job's pattern is found again. */
  resultUri?: string;
  error?: string;
};

type JobTarget = {
  listId: string;
  patternName: string;
};

export type StartJob = JobTarget &
  (
    | {
        kind: "deidentify";
        provider: DeidentifyProvider;
        request: DeidentifyRequest;
        consent?: Consent;
      }
    | {
        kind: "shorten";
        request: TrimRequest;
        /** Provenance of the source, carried over: a shortened silhouette is still one. */
        generated?: IGeneratedVideo;
      }
    | {
        kind: "transcribe";
        request: TranscribeRequest;
      }
  );

/** L4: transcribe what is said in a video; the transcript lands on the same video. */
export type TranscribeRequest = {
  sourceUri: string;
  /** ISO 639-1, or omitted to detect it. */
  language?: string;
  /** Whisper's initial prompt — the list's own words (see vocabularyPrompt). */
  vocabulary?: string;
};

/**
 * Puts a finished video into the list through whoever holds it in memory. Returns false when
 * that is not the list it holds, and the store then writes storage itself.
 */
export type AttachHandler = (
  listId: string,
  oldUri: string,
  update: VideoUpdate,
) => Promise<boolean>;

/**
 * Video jobs — de-identifying or shortening a pattern's video — held outside React on purpose. Android can destroy the activity while
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
        kind: job.kind,
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

async function attach(listId: string, oldUri: string, update: VideoUpdate) {
  recordReplacement(oldUri, update);
  if (attachHandler && (await attachHandler(listId, oldUri, update))) return;
  const patterns = await loadPatterns(listId);
  const swapped = patterns.map((p) => replaceVideoInPattern(p, oldUri, update));
  if (swapped.some((p, i) => p !== patterns[i])) {
    await savePatterns(listId, swapped);
  }
}

/**
 * Dev builds log each run's stats for the desktop replica (scratchpad/phone_replica.py). logcat
 * cuts lines at ~4000 characters and the per-frame diagnostics are longer, so they go out in
 * numbered chunks that `grep '\[deidentify\]'` can reassemble.
 */
function logStats(outcome: unknown) {
  if (!__DEV__) return;
  const json = JSON.stringify(outcome);
  const size = 3000;
  const parts = Math.ceil(json.length / size);
  for (let i = 0; i < parts; i++) {
    console.log(
      `[deidentify] ${i + 1}/${parts} ${json.slice(i * size, (i + 1) * size)}`,
    );
  }
}

/** Runs the job's pass; returns the cache URI of the result and its provenance. */
async function process(
  id: string,
  job: StartJob & { kind: "deidentify" | "shorten" },
): Promise<{ uri: string; generated?: IGeneratedVideo }> {
  const onProgress = (fraction: number) => patch(id, { progress: fraction });
  if (job.kind === "shorten") {
    const uri = await shortenVideo(job.request, onProgress);
    return { uri, generated: job.generated };
  }
  const outcome = await runDeidentify(
    job.provider,
    job.request,
    ({ fraction }) => onProgress(fraction),
    job.consent,
  );
  logStats(outcome);
  return {
    uri: outcome.uri,
    generated: { method: job.provider.id, createdAt: Date.now() },
  };
}

/**
 * Transcribes the job's video and puts the transcript on it — the same video, so nothing is
 * stored or replaced; whatever the reference already carries is kept.
 */
async function transcribe(id: string, job: StartJob & { kind: "transcribe" }) {
  const { promise } = transcribeVideo(job.request.sourceUri, {
    language: job.request.language,
    prompt: job.request.vocabulary,
    onProgress: (fraction) => patch(id, { progress: fraction }),
  });
  const { transcript } = await promise;
  await attach(job.listId, job.request.sourceUri, (ref) => ({
    ...ref,
    transcript,
  }));
  patch(id, {
    status: "done",
    progress: 1,
    resultUri: job.request.sourceUri,
  });
}

async function run(id: string, job: StartJob) {
  patch(id, { status: "running" });
  try {
    const list = await getPatternListById(job.listId);
    if (list?.readonly) throw new Error("This list is read-only");
    if (job.kind === "transcribe") return await transcribe(id, job);
    const { uri, generated } = await process(id, job);
    const stored = await persistVideo(
      uri,
      job.kind === "shorten" ? "shortened" : "deidentified",
    );
    try {
      new File(uri).delete(); // the cache copy
    } catch {
      // best effort — the cache is the OS's to clear anyway
    }
    // A new video in place of the old; what was said in the old one is still what was said
    // (L4) — the transcript moves over, though a silhouette has no sound of its own.
    await attach(job.listId, job.request.sourceUri, (previous) => ({
      type: "local",
      value: stored,
      ...(generated && { generated }),
      ...(previous.transcript && { transcript: previous.transcript }),
    }));
    patch(id, { status: "done", progress: 1, resultUri: stored });
  } catch (e) {
    patch(id, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
