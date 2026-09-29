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
import {
  NoAudioError,
  transcribeVideo,
} from "@/src/transcribe/transcribeVideo";
import {
  ensureModels,
  installedModels,
  ModelDownloadError,
} from "@/src/transcribe/modelStore";

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
  /** An i18n key for a failure the user can act on, shown instead of [error]. */
  errorKey?: string;
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
/** Jobs the user cancelled before they ran; `run` skips them. */
const cancelled = new Set<string>();
/** How to stop the running job early, when its kind can be stopped. */
let stopRunning: { id: string; stop: () => void } | null = null;

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

  /**
   * Cancels a job: a queued one never runs, and a running transcription stops. The other kinds
   * cannot be stopped once running (the native pipeline has no stop), so they are left be.
   * A cancelled job leaves the list at once.
   */
  cancel(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job || !jobStore.canCancel(job)) return;
    cancelled.add(id);
    // A transcription still downloading its models has nothing to stop yet; it checks before
    // it starts transcribing.
    if (stopRunning?.id === id) stopRunning.stop();
    jobs = jobs.filter((j) => j.id !== id);
    emit();
  },

  /** Whether `cancel` would do anything for this job. */
  canCancel(job: DeidentifyJob): boolean {
    return (
      job.status === "queued" ||
      (job.status === "running" && job.kind === "transcribe")
    );
  },

  /** Removes finished and failed jobs. */
  dismissFinished() {
    jobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
    emit();
  },

  /**
   * Runs work in turn with the jobs, never beside one: the suggestion model (L4) takes ~3.4 GB
   * while loaded, and next to Whisper or the silhouette pipeline it would not fit in memory. It
   * starts once everything queued before it has finished.
   */
  runExclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = queue.then(work);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  },

  /** Test hook: forget everything, and wait for a running job first. */
  async reset() {
    await queue;
    jobs = [];
    cancelled.clear();
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
 * Share of a transcription job's progress that downloading the models takes, when they are
 * missing: ~60 MB is seconds on Wi-Fi and a minute on a slow line. One count to 100% for the
 * whole job — the user waits for the transcript, not for a stage.
 */
const DOWNLOAD_SHARE = 0.3;

/**
 * Transcribes the job's video and puts the transcript on it — the same video, so nothing is
 * stored or replaced; whatever the reference already carries is kept. Downloads the models
 * first when they are not on the device (the user agreed to that before starting the job).
 */
async function transcribe(id: string, job: StartJob & { kind: "transcribe" }) {
  let base = 0;
  if (!installedModels()) {
    await ensureModels((f) => patch(id, { progress: f * DOWNLOAD_SHARE }));
    base = DOWNLOAD_SHARE;
  }
  if (cancelled.delete(id)) return;
  const { promise, stop } = transcribeVideo(job.request.sourceUri, {
    language: job.request.language,
    prompt: job.request.vocabulary,
    onProgress: (fraction) =>
      patch(id, { progress: base + fraction * (1 - base) }),
  });
  stopRunning = { id, stop };
  let transcript;
  try {
    ({ transcript } = await promise);
  } finally {
    stopRunning = null;
  }
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
  if (cancelled.delete(id)) return;
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
    if (cancelled.delete(id)) return; // stopped on request; the job is already gone
    patch(id, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      ...(e instanceof NoAudioError && { errorKey: "transcribeErrorNoSound" }),
      ...(e instanceof ModelDownloadError && {
        errorKey: "transcribeErrorDownload",
      }),
    });
  }
}
