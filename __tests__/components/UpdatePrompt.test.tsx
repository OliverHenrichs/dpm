import React from "react";
import UpdatePrompt from "@/src/changelog/components/UpdatePrompt";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  act,
} from "@/utils/renderWithProviders";
import {
  peekAsyncStorage,
  seedAsyncStorage,
} from "@/__mocks__/@react-native-async-storage/async-storage";
import type { InstallStatusEvent, UpdateCheck } from "@/modules/app-update";

// The native module is absent under jest; this one stands in for Play.
const mockNative = {
  check: jest.fn<Promise<UpdateCheck>, []>(),
  startFlexibleUpdate: jest.fn(async () => "accepted" as const),
  completeUpdate: jest.fn(async () => undefined),
  listeners: [] as ((e: InstallStatusEvent) => void)[],
  addListener: jest.fn(
    (_name: string, listener: (e: InstallStatusEvent) => void) => {
      mockNative.listeners.push(listener);
      return { remove: jest.fn() };
    },
  ),
};
jest.mock("@/modules/app-update", () => ({
  get AppUpdateModule() {
    return mockNative;
  },
  isAppUpdateAvailable: true,
}));

const mockJobs: { status: string }[] = [];
jest.mock("@/src/anonymize/jobs/AnonymizeJobsContext", () => ({
  useAnonymizeJobs: () => ({ jobs: mockJobs }),
}));

const update = (over: Partial<UpdateCheck> = {}): UpdateCheck => ({
  available: true,
  flexibleAllowed: true,
  availableVersionCode: 42,
  stalenessDays: 0,
  status: "unknown",
  ...over,
});

const hidden = { includeHiddenElements: true };
const emit = (status: InstallStatusEvent["status"]) =>
  act(() => {
    mockNative.listeners.forEach((l) =>
      l({ status, bytesDownloaded: 1, totalBytesToDownload: 1 }),
    );
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.listeners = [];
  mockJobs.length = 0;
});

describe("UpdatePrompt", () => {
  it("shows Play's dialog for a new version and remembers asking", async () => {
    mockNative.check.mockResolvedValue(update());
    renderWithProviders(<UpdatePrompt />);

    await waitFor(() =>
      expect(mockNative.startFlexibleUpdate).toHaveBeenCalledTimes(1),
    );
    expect(
      JSON.parse(peekAsyncStorage()["@updatePromptAsked"] as string),
    ).toMatchObject({ versionCode: 42 });
  });

  it("doesn't ask again within a week", async () => {
    seedAsyncStorage({
      "@updatePromptAsked": JSON.stringify({ versionCode: 42, at: Date.now() }),
    });
    mockNative.check.mockResolvedValue(update());
    renderWithProviders(<UpdatePrompt />);

    await waitFor(() => expect(mockNative.check).toHaveBeenCalled());
    expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
  });

  it("offers a restart once downloaded, and restarts into the update", async () => {
    mockNative.check.mockResolvedValue(update());
    renderWithProviders(<UpdatePrompt />);
    await waitFor(() =>
      expect(mockNative.startFlexibleUpdate).toHaveBeenCalled(),
    );

    expect(screen.queryByText("Update ready", hidden)).toBeNull();
    await emit("downloaded");
    expect(await screen.findByText("Update ready", hidden)).toBeOnTheScreen();

    fireEvent.press(screen.getByText("Restart", hidden));
    expect(mockNative.completeUpdate).toHaveBeenCalledTimes(1);
  });

  it("offers a restart at launch for an update downloaded earlier", async () => {
    mockNative.check.mockResolvedValue(
      update({ available: false, status: "downloaded" }),
    );
    renderWithProviders(<UpdatePrompt />);

    expect(await screen.findByText("Update ready", hidden)).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Later", hidden));
    await waitFor(() =>
      expect(screen.queryByText("Update ready", hidden)).toBeNull(),
    );
    expect(mockNative.completeUpdate).not.toHaveBeenCalled();
  });

  it("waits for video work to finish before offering the restart", async () => {
    mockJobs.push({ status: "running" });
    mockNative.check.mockResolvedValue(
      update({ available: false, status: "downloaded" }),
    );
    renderWithProviders(<UpdatePrompt />);

    await waitFor(() => expect(mockNative.check).toHaveBeenCalled());
    expect(screen.queryByText("Update ready", hidden)).toBeNull();
  });

  it("stays quiet when Play can't be asked", async () => {
    mockNative.check.mockRejectedValue(new Error("not installed from Play"));
    renderWithProviders(<UpdatePrompt />);

    await waitFor(() => expect(mockNative.check).toHaveBeenCalled());
    expect(mockNative.startFlexibleUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("Update ready", hidden)).toBeNull();
  });
});
