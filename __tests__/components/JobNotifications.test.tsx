import React from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import { AnonymizeJobsProvider } from "@/src/anonymize/jobs/AnonymizeJobsContext";
import { resetNotificationPermissionAsked } from "@/src/anonymize/jobs/jobNotifications";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { AnonymizeProvider } from "@/src/anonymize/providers/AnonymizeProvider";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";
import { act, renderWithProviders, waitFor } from "@/utils/renderWithProviders";

const SOURCE = "file:///document/video-src.mp4";
const OUTPUT = "file:///cache/anonymized-out.mp4";

const mocked = jest.mocked(Notifications);

/** A provider that finishes when the test says so, or fails. */
function gatedProvider(fail = false, output = OUTPUT) {
  let finish: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (finish = resolve));
  const provider: AnonymizeProvider = {
    id: "fake",
    labelKey: "anonymizeProviderTracking",
    minSeconds: 1,
    maxSeconds: 30,
    sendsFootageOffDevice: false,
    promptCount: 0,
    isAvailable: () => true,
    run: async () => {
      await gate;
      if (fail) throw new Error("no GPU");
      return { uri: output };
    },
  };
  return { provider, finish };
}

function setup() {
  const list = createTestPatternList();
  const pattern = createTestPattern("t", {
    id: 1,
    name: "Sugar Push",
    videoRefs: [{ type: "local", value: SOURCE }],
  });
  renderWithProviders(
    <AnonymizeJobsProvider>
      <></>
    </AnonymizeJobsProvider>,
    { lists: [list], patterns: { [list.id]: [pattern] } },
  );
  return list;
}

const start = (listId: string, provider: AnonymizeProvider) =>
  act(() => {
    jobStore.start({
      kind: "anonymize",
      listId,
      patternName: "Sugar Push",
      provider,
      request: { sourceUri: SOURCE, startSeconds: 0, endSeconds: 10 },
    });
  });

let appState: AppStateStatus = "active";
const originalState = Object.getOwnPropertyDescriptor(AppState, "currentState");

beforeEach(() => {
  seedBinaryFile(OUTPUT, Buffer.from([1, 2]));
  resetNotificationPermissionAsked();
  appState = "active";
  Object.defineProperty(AppState, "currentState", {
    configurable: true,
    get: () => appState,
  });
});
afterEach(async () => {
  await jobStore.reset();
  if (originalState) {
    Object.defineProperty(AppState, "currentState", originalState);
  }
});

describe("the video jobs' notification", () => {
  it("asks for permission when a job starts, after creating the channel", async () => {
    const list = setup();
    const { provider, finish } = gatedProvider();

    await start(list.id, provider);

    await waitFor(() =>
      expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1),
    );
    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      "video-jobs",
      expect.objectContaining({ name: "Video work" }),
    );
    finish();
  });

  it("does not ask again when the user already decided", async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: false,
    } as Notifications.NotificationPermissionsStatus);
    const list = setup();
    const { provider, finish } = gatedProvider();

    await start(list.id, provider);

    await waitFor(() => expect(mocked.getPermissionsAsync).toHaveBeenCalled());
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    finish();
  });

  it("says the results wait for review when the batch finishes in the background", async () => {
    const list = setup();
    const { provider, finish } = gatedProvider();
    await start(list.id, provider);

    appState = "background";
    await act(async () => finish());

    await waitFor(() =>
      expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: "video-jobs-finished",
        content: {
          title: "Your video work is finished",
          body: "Open DPM to review the results.",
          color: "#6366f1",
        },
        trigger: { channelId: "video-jobs" },
      }),
    );
  });

  it("says so when the batch failed", async () => {
    const list = setup();
    const { provider, finish } = gatedProvider(true);
    await start(list.id, provider);

    appState = "background";
    await act(async () => finish());

    await waitFor(() =>
      expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            body: "Something went wrong. Open DPM to see what.",
          }),
        }),
      ),
    );
  });

  it("posts one notification for a batch of several jobs", async () => {
    const list = setup();
    const first = gatedProvider();
    // Each run deletes its cache copy once stored, so the second needs its own.
    const second = gatedProvider(false, "file:///cache/anonymized-two.mp4");
    seedBinaryFile("file:///cache/anonymized-two.mp4", Buffer.from([3]));
    await start(list.id, first.provider);
    await start(list.id, second.provider);

    appState = "background";
    await act(async () => first.finish());
    await act(async () => second.finish());

    await waitFor(() =>
      expect(jobStore.getJobs().every((j) => j.status === "review")).toBe(true),
    );
    await waitFor(() =>
      expect(mocked.scheduleNotificationAsync).toHaveBeenCalledTimes(1),
    );
  });

  it("stays quiet while the app is open", async () => {
    const list = setup();
    const { provider, finish } = gatedProvider();
    await start(list.id, provider);

    await act(async () => finish());

    await waitFor(() => expect(jobStore.getJobs()[0].status).toBe("review"));
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("opens the pattern list when tapped", () => {
    setup();
    const [[listener]] = mocked.addNotificationResponseReceivedListener.mock
      .calls as unknown as [[(r: object) => void]];

    listener({
      notification: { request: { identifier: "video-jobs-finished" } },
    });

    expect(router.navigate).toHaveBeenCalledWith("/patterns");
  });
});
