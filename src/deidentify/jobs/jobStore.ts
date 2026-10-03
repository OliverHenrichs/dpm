import { File } from "expo-file-system";
import {
  getPatternListById,
  loadPatterns,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { persistVideo } from "@/src/pattern/data/videoFiles";
import { trimTranscript } from "@/src/pattern/data/transcripts";
import { generateUUID } from "@/src/pattern/types/PatternType";
import {
  IGeneratedVideo,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
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
  downloadModel,
  ensureModels,
  installedModelUri,
  installedModels,
  ModelDownloadError,
} from "@/src/transcribe/modelStore";
import { SUGGESTION_MODEL } from "@/src/suggest/models";
import { runSuggestion } from "@/src/suggest/runSuggestion";
import { Suggestion } from "@/src/suggest/suggestPrompt";

/**
 * `review`: a shortened or de-identified video is ready, and waits for the user to look at it
 * and keep it (in place of the original, or beside it) or discard it. Nothing in the pattern
 * changes until then. A transcription that was asked to suggest a name and description waits
 * the same way, with its transcript already on the video, for the user to use the suggestion
 * or not.
 */
export type JobStatus = "queued" | "running" | "review" | "done" | "failed";

/** What to do with a reviewed result: put it in place of the original, or add it beside it. */
export type KeepMode = "replace" | "both";

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
  /**
   * The new video: waiting for review, or in the pattern once done (a transcription's is the
   * source itself) — how the job's pattern is found again.
   */
  resultUri?: string;
  /** The part of the source a shortened or de-identified video was cut from, in seconds. */
  clip?: { start: number; end: number };
  error?: string;
  /** An i18n key for a failure the user can act on, shown instead of [error]. */
  errorKey?: string;
  /** What a transcribe-and-suggest job suggests, once it is waiting for review. */
  suggestion?: Suggestion;
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
  /**
   * Then suggest a name and description from the transcript, downloading the suggestion model
   * first when it is missing (the user agreed to that, told its size, before starting).
   */
  suggest?: { vocabulary: string[] };
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
/** Finished videos waiting for review, by job id: what keeping one puts into the pattern. */
const pending = new Map<string, { generated?: IGeneratedVideo }>();
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
        ...(job.kind !== "transcribe" && {
          clip: {
            start: job.request.startSeconds,
            end: job.request.endSeconds,
          },
        }),
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

  /** Removes finished and failed jobs; a result waiting for review stays. */
  dismissFinished() {
    jobs = jobs.filter(
      (j) =>
        j.status === "queued" ||
        j.status === "running" ||
        j.status === "review",
    );
    emit();
  },

  /**
   * Keeps a reviewed result: in place of the original (`replace`), or added right after it
   * (`both`). What was said in the part kept moves over with the new video, retimed to the cut;
   * with `replace` the lines outside it go.
   */
  async keep(id: string, mode: KeepMode) {
    const job = jobs.find((j) => j.id === id);
    const result = pending.get(id);
    if (job?.status !== "review" || !job.resultUri || !result) return;
    pending.delete(id);
    const value = job.resultUri;
    const clip = job.clip;
    const { generated } = result;
    const made = (previous: IVideoReference): IVideoReference => ({
      type: "local",
      value,
      ...(generated && { generated }),
      ...(previous.transcript &&
        clip && {
          transcript: trimTranscript(previous.transcript, clip.start, clip.end),
        }),
    });
    try {
      await attach(job.listId, job.sourceUri, (previous) =>
        mode === "replace" ? made(previous) : [previous, made(previous)],
      );
      patch(id, { status: "done" });
    } catch (e) {
      patch(id, {
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  /** Closes a suggestion's review, used or not; the transcript stays on its video. */
  settle(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (job?.status !== "review" || job.kind !== "transcribe") return;
    patch(id, { status: "done" });
  },

  /** Throws a reviewed result away; the original stays as it was. */
  discard(id: string) {
    const job = jobs.find((j) => j.id === id);
    if (job?.status !== "review") return;
    pending.delete(id);
    deleteQuietly(job.resultUri);
    jobs = jobs.filter((j) => j.id !== id);
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
    pending.clear();
    cancelled.clear();
    attachHandler = null;
    emit();
  },
};

/** Best effort: a file the app no longer needs, in the cache or its own storage. */
function deleteQuietly(uri: string | undefined) {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // the cache is the OS's to clear anyway, and a stray file costs only space
  }
}

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

/** Share of a transcribe-and-suggest job's count that the transcript takes. */
const TRANSCRIPT_SHARE = 0.6;

/**
 * Transcribes the job's video and puts the transcript on it — the same video, so nothing is
 * stored or replaced; whatever the reference already carries is kept. Downloads the models
 * first when they are not on the device (the user agreed to that before starting the job).
 */
async function transcribe(id: string, job: StartJob & { kind: "transcribe" }) {
  const suggest = job.request.suggest;
  // With a suggestion to follow, the transcript is the first part of the count.
  const end = suggest ? TRANSCRIPT_SHARE : 1;
  let base = 0;
  if (!installedModels()) {
    await ensureModels((f) =>
      patch(id, { progress: f * DOWNLOAD_SHARE * end }),
    );
    base = DOWNLOAD_SHARE * end;
  }
  if (cancelled.delete(id)) return;
  const { promise, stop } = transcribeVideo(job.request.sourceUri, {
    language: job.request.language,
    prompt: job.request.vocabulary,
    onProgress: (fraction) =>
      patch(id, { progress: base + fraction * (end - base) }),
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
  if (!suggest || transcript.segments.length === 0) {
    patch(id, {
      status: "done",
      progress: 1,
      resultUri: job.request.sourceUri,
    });
    return;
  }
  if (cancelled.delete(id)) return;
  patch(id, { progress: end, resultUri: job.request.sourceUri });
  // The transcript is in; a failed suggestion is reported on its review, not as a failed job.
  try {
    if (!installedModelUri(SUGGESTION_MODEL)) {
      await downloadModel(SUGGESTION_MODEL, (written) =>
        patch(id, {
          progress: end + (written / SUGGESTION_MODEL.bytes) * (1 - end) * 0.9,
        }),
      );
    }
    const suggestion = await runSuggestion({
      transcript: transcript.segments.map((s) => s.text).join(" "),
      language: transcript.language,
      vocabulary: suggest.vocabulary,
    });
    patch(id, { status: "review", progress: 1, suggestion });
  } catch {
    patch(id, { status: "review", progress: 1, errorKey: "suggestFailed" });
  }
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
    deleteQuietly(uri); // the cache copy
    // The user looks at it before it goes into the pattern; see `keep` and `discard`.
    pending.set(id, { generated });
    patch(id, { status: "review", progress: 1, resultUri: stored });
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
