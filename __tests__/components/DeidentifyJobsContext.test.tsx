import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import {
  DeidentifyJobsProvider,
  useDeidentifyJobs,
} from "@/src/deidentify/jobs/DeidentifyJobsContext";
import { clearReplacements } from "@/src/deidentify/jobs/replaceVideo";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import { act, renderWithProviders, waitFor } from "@/utils/renderWithProviders";

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
const Probe = () => {
  jobs = useDeidentifyJobs();
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

beforeEach(() => seedBinaryFile(OUTPUT, Buffer.from([1, 2])));
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
