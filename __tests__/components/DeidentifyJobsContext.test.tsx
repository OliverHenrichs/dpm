import React, { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import {
  DeidentifyJobsProvider,
  useDeidentifyJobs,
} from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { clearReplacements } from "@/src/deidentify/jobs/replaceVideo";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
import {
  IPattern,
  IPatternList,
  IVideoTranscript,
} from "@/src/pattern/types/IPatternList";
import {
  NoAudioError,
  transcribeVideo,
} from "@/src/transcribe/transcribeVideo";
import {
  ensureModels,
  installedModels,
  ModelDownloadError,
} from "@/src/transcribe/modelStore";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import { act, renderWithProviders, waitFor } from "@/utils/renderWithProviders";

// The engine has its own suite; here a job only needs its outcome.
jest.mock("@/src/transcribe/transcribeVideo", () => ({
  ...jest.requireActual("@/src/transcribe/transcribeVideo"),
  transcribeVideo: jest.fn(),
}));
// Installed unless a test says otherwise; the store itself has its own suite.
jest.mock("@/src/transcribe/modelStore", () => ({
  ...jest.requireActual("@/src/transcribe/modelStore"),
  installedModels: jest.fn(),
  ensureModels: jest.fn(),
}));
const mockedInstalled = installedModels as jest.MockedFunction<
  typeof installedModels
>;
const mockedEnsure = ensureModels as jest.MockedFunction<typeof ensureModels>;
const mockedTranscribe = transcribeVideo as jest.MockedFunction<
  typeof transcribeVideo
>;

const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 0.5, end: 2, text: "Anchor on five and six." }],
};

const TIMING = {
  audioSeconds: 3,
  speechSeconds: 2,
  regions: 1,
  extractMs: 1,
  transcribeMs: 1,
};

const SOURCE = "file:///document/video-src.mp4";
const OUTPUT = "file:///cache/deidentified-out.mp4";

const fakeProvider = (
  run: DeidentifyProvider["run"] = async (_r, onProgress) => {
    onProgress({ stage: "track", fraction: 0.5 });
    return { uri: OUTPUT };
  },
): DeidentifyProvider => ({
  id: "fake",
  labelKey: "deidentifyProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 0,
  isAvailable: () => true,
  run,
});

let jobs: ReturnType<typeof useDeidentifyJobs>;
/** Hands the hook's latest value to the test — from an effect, not mid-render. */
const Probe = () => {
  const current = useDeidentifyJobs();
  useEffect(() => {
    jobs = current;
  });
  return null;
};

const storedPatterns = async (listId: string): Promise<IPattern[]> =>
  JSON.parse((await AsyncStorage.getItem(`@patterns_${listId}`)) ?? "[]");

function setup(listOverrides: Partial<IPatternList> = {}) {
  const list = createTestPatternList(listOverrides);
  const pattern = createTestPattern("t", {
    id: 1,
    name: "Sugar Push",
    videoRefs: [{ type: "local", value: SOURCE }],
  });
  const view = renderWithProviders(
    <DeidentifyJobsProvider>
      <Probe />
    </DeidentifyJobsProvider>,
    { lists: [list], patterns: { [list.id]: [pattern] } },
  );
  return { list, view };
}

const startJob = (listId: string, provider = fakeProvider()) =>
  act(() =>
    jobs.start({
      kind: "deidentify",
      listId,
      patternName: "Sugar Push",
      provider,
      request: { sourceUri: SOURCE, startSeconds: 0, endSeconds: 10 },
    }),
  );

beforeEach(() => {
  seedBinaryFile(OUTPUT, Buffer.from([1, 2]));
  mockedInstalled.mockReturnValue({ whisperUri: "w", vadUri: "v" });
});
afterEach(async () => {
  await jobStore.reset();
  clearReplacements();
});

describe("DeidentifyJobsProvider", () => {
  it("replaces the video in the pattern with the de-identified one, marked as generated", async () => {
    const { list } = setup();
    await waitFor(async () =>
      expect(await storedPatterns(list.id)).toHaveLength(1),
    );

    await startJob(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    const [saved] = await storedPatterns(list.id);
    expect(saved.videoRefs).toHaveLength(1);
    expect(saved.videoRefs[0].value).toMatch(
      /^file:\/\/\/document\/deidentified-/,
    );
    expect(saved.videoRefs[0].generated?.method).toBe("fake");
  });

  it("reports a failure and leaves the pattern alone", async () => {
    const { list } = setup();
    await startJob(
      list.id,
      fakeProvider(async () => {
        throw new Error("no GPU");
      }),
    );

    await waitFor(() => expect(jobs.jobs[0].status).toBe("failed"));
    expect(jobs.jobs[0].error).toBe("no GPU");
    expect((await storedPatterns(list.id))[0].videoRefs[0].value).toBe(SOURCE);
  });

  it("refuses to touch a read-only list", async () => {
    const { list } = setup({ readonly: true });
    const run = jest.fn();
    await startJob(list.id, fakeProvider(run));

    await waitFor(() => expect(jobs.jobs[0].status).toBe("failed"));
    expect(run).not.toHaveBeenCalled();
  });

  it("survives the app's tree being torn down mid-run, and still attaches the video", async () => {
    const { list, view } = setup();
    await waitFor(async () =>
      expect(await storedPatterns(list.id)).toHaveLength(1),
    );
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    await startJob(
      list.id,
      fakeProvider(async () => {
        await gate;
        return { uri: OUTPUT };
      }),
    );
    await waitFor(() => expect(jobs.jobs[0].status).toBe("running"));

    // Android destroyed the activity; React mounts a fresh tree in the same process.
    view.unmount();
    renderWithProviders(
      <DeidentifyJobsProvider>
        <Probe />
      </DeidentifyJobsProvider>,
      { lists: [list] },
    );
    expect(jobs.jobs[0].status).toBe("running");

    await act(async () => finish());
    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    const [saved] = await storedPatterns(list.id);
    expect(saved.videoRefs[0].value).toMatch(
      /^file:\/\/\/document\/deidentified-/,
    );
  });

  it("dismisses finished jobs", async () => {
    const { list } = setup();
    await startJob(list.id);
    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));

    act(() => jobs.dismissFinished());

    expect(jobs.jobs).toEqual([]);
  });
});

describe("transcription jobs (L4)", () => {
  const startTranscribe = (listId: string) =>
    act(() =>
      jobs.start({
        kind: "transcribe",
        listId,
        patternName: "Sugar Push",
        request: { sourceUri: SOURCE, vocabulary: "Sugar Push." },
      }),
    );

  it("puts the transcript on the same video, keeping the video", async () => {
    mockedTranscribe.mockReturnValue({
      promise: Promise.resolve({
        transcript: TRANSCRIPT,
        timing: {
          audioSeconds: 3,
          speechSeconds: 2,
          regions: 1,
          extractMs: 1,
          transcribeMs: 1,
        },
      }),
      stop: jest.fn(),
    });
    const { list } = setup();
    await waitFor(async () =>
      expect(await storedPatterns(list.id)).toHaveLength(1),
    );

    await startTranscribe(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    expect(jobs.jobs[0].resultUri).toBe(SOURCE);
    expect(mockedTranscribe).toHaveBeenCalledWith(
      SOURCE,
      expect.objectContaining({ prompt: "Sugar Push." }),
    );
    const [saved] = await storedPatterns(list.id);
    expect(saved.videoRefs).toEqual([
      { type: "local", value: SOURCE, transcript: TRANSCRIPT },
    ]);
  });

  it("reports a video without sound, and leaves the pattern alone", async () => {
    mockedTranscribe.mockReturnValue({
      promise: Promise.reject(new NoAudioError()),
      stop: jest.fn(),
    });
    const { list } = setup();

    await startTranscribe(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("failed"));
    expect(jobs.jobs[0].errorKey).toBe("transcribeErrorNoSound");
    expect((await storedPatterns(list.id))[0].videoRefs[0]).toEqual({
      type: "local",
      value: SOURCE,
    });
  });

  it("downloads missing models first, counting to 100% once", async () => {
    mockedInstalled.mockReturnValue(null);
    mockedEnsure.mockImplementation(async (onProgress) => {
      onProgress?.(0.5);
      onProgress?.(1);
      return { whisperUri: "w", vadUri: "v" };
    });
    const seen: number[] = [];
    mockedTranscribe.mockImplementation((_uri, options) => {
      options?.onProgress?.(0.5);
      return {
        promise: Promise.resolve({ transcript: TRANSCRIPT, timing: TIMING }),
        stop: jest.fn(),
      };
    });
    const unsubscribe = jobStore.subscribe(() => {
      const job = jobStore.getJobs()[0];
      if (job?.status === "running") seen.push(job.progress);
    });
    const { list } = setup();

    await startTranscribe(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    unsubscribe();
    expect(mockedEnsure).toHaveBeenCalled();
    expect(seen.map((f) => Math.round(f * 100))).toEqual([0, 15, 30, 65]);
  });

  it("reports a failed download in words the user can act on", async () => {
    mockedInstalled.mockReturnValue(null);
    mockedEnsure.mockRejectedValue(new ModelDownloadError("HTTP 500"));
    const { list } = setup();

    await startTranscribe(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("failed"));
    expect(jobs.jobs[0].errorKey).toBe("transcribeErrorDownload");
    expect(mockedTranscribe).not.toHaveBeenCalled();
  });

  it("stops a running transcription on cancel and forgets the job", async () => {
    let reject: (e: Error) => void = () => undefined;
    const stop = jest.fn(() => reject(new Error("Transcription stopped")));
    mockedTranscribe.mockReturnValue({
      promise: new Promise((_, r) => (reject = r)),
      stop,
    });
    const { list } = setup();
    await startTranscribe(list.id);
    await waitFor(() => expect(jobs.jobs[0]?.status).toBe("running"));
    await waitFor(() => expect(mockedTranscribe).toHaveBeenCalled());
    expect(jobs.canCancel(jobs.jobs[0])).toBe(true);

    await act(() => jobs.cancel(jobs.jobs[0].id));

    expect(stop).toHaveBeenCalled();
    await waitFor(() => expect(jobs.jobs).toEqual([]));
    expect((await storedPatterns(list.id))[0].videoRefs[0]).toEqual({
      type: "local",
      value: SOURCE,
    });
  });

  it("never runs a queued job that was cancelled", async () => {
    let finish: () => void = () => undefined;
    mockedTranscribe.mockReturnValueOnce({
      promise: new Promise((resolve) => {
        finish = () => resolve({ transcript: TRANSCRIPT, timing: TIMING });
      }),
      stop: jest.fn(),
    });
    const { list } = setup();
    await startTranscribe(list.id);
    await startTranscribe(list.id);
    await waitFor(() => expect(jobs.jobs[1]?.status).toBe("queued"));

    await act(() => jobs.cancel(jobs.jobs[1].id));
    expect(jobs.jobs).toHaveLength(1);
    await act(async () => finish());

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    expect(mockedTranscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps only the part of the transcript inside the cut, retimed", async () => {
    const list = createTestPatternList();
    const transcript = {
      ...TRANSCRIPT,
      segments: [
        { start: 1, end: 2, text: "Before the cut." },
        { start: 4, end: 6, text: "Anchor on five and six." },
        { start: 12, end: 13, text: "After the cut." },
      ],
    };
    const pattern = createTestPattern("t", {
      id: 1,
      videoRefs: [{ type: "local", value: SOURCE, transcript }],
    });
    renderWithProviders(
      <DeidentifyJobsProvider>
        <Probe />
      </DeidentifyJobsProvider>,
      { lists: [list], patterns: { [list.id]: [pattern] } },
    );
    await waitFor(async () =>
      expect(await storedPatterns(list.id)).toHaveLength(1),
    );

    act(() => {
      jobs.start({
        kind: "deidentify",
        listId: list.id,
        patternName: "Sugar Push",
        provider: fakeProvider(),
        request: { sourceUri: SOURCE, startSeconds: 3, endSeconds: 10 },
      });
    });

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    const [saved] = await storedPatterns(list.id);
    expect(saved.videoRefs[0].transcript!.segments).toEqual([
      { start: 1, end: 3, text: "Anchor on five and six." },
    ]);
  });

  it("carries a transcript over when the video is de-identified", async () => {
    const list = createTestPatternList();
    const pattern = createTestPattern("t", {
      id: 1,
      name: "Sugar Push",
      videoRefs: [{ type: "local", value: SOURCE, transcript: TRANSCRIPT }],
    });
    renderWithProviders(
      <DeidentifyJobsProvider>
        <Probe />
      </DeidentifyJobsProvider>,
      { lists: [list], patterns: { [list.id]: [pattern] } },
    );
    await waitFor(async () =>
      expect(await storedPatterns(list.id)).toHaveLength(1),
    );

    await startJob(list.id);

    await waitFor(() => expect(jobs.jobs[0].status).toBe("done"));
    const [saved] = await storedPatterns(list.id);
    expect(saved.videoRefs[0].value).toMatch(/deidentified-/);
    // What was said is still what was said, though a silhouette has no sound.
    expect(saved.videoRefs[0].transcript).toEqual(TRANSCRIPT);
  });
});
