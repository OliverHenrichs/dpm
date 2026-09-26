import { DeidentifyProvider } from "@/src/deidentify/providers/DeidentifyProvider";
import { availableProviders } from "@/src/deidentify/providers/registry";
import {
  ConsentRequiredError,
  PromptsRequiredError,
  runDeidentify,
  TrimOutOfLimitsError,
} from "@/src/deidentify/runDeidentify";

/** Shaped like a remote service such as Viggle: 5–15 s, footage leaves the device. */
const remote = (
  overrides: Partial<DeidentifyProvider> = {},
): DeidentifyProvider => ({
  id: "remote-test",
  labelKey: "remoteTest",
  minSeconds: 5,
  maxSeconds: 15,
  sendsFootageOffDevice: true,
  promptCount: 0,
  isAvailable: () => true,
  run: jest.fn(async () => ({ uri: "file:///out.mp4" })),
  ...overrides,
});

const request = {
  sourceUri: "file:///in.mp4",
  startSeconds: 10,
  endSeconds: 20,
};

describe("runDeidentify", () => {
  it("refuses to send footage off the device without consent", async () => {
    const provider = remote();
    await expect(
      runDeidentify(provider, request, jest.fn()),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(provider.run).not.toHaveBeenCalled();
  });

  it("runs a remote provider once consent is recorded", async () => {
    const provider = remote();
    await expect(
      runDeidentify(provider, request, jest.fn(), { givenAt: 1 }),
    ).resolves.toEqual({ uri: "file:///out.mp4" });
    expect(provider.run).toHaveBeenCalledWith(request, expect.any(Function));
  });

  it("needs no consent for an on-device provider", async () => {
    const provider = remote({ sendsFootageOffDevice: false });
    await expect(
      runDeidentify(provider, request, jest.fn()),
    ).resolves.toBeDefined();
  });

  it("rejects a window longer than the provider accepts, before any call", async () => {
    const provider = remote();
    await expect(
      runDeidentify(provider, { ...request, endSeconds: 30 }, jest.fn(), {
        givenAt: 1,
      }),
    ).rejects.toBeInstanceOf(TrimOutOfLimitsError);
    expect(provider.run).not.toHaveBeenCalled();
  });

  it("rejects a window shorter than the provider accepts", async () => {
    await expect(
      runDeidentify(remote(), { ...request, endSeconds: 12 }, jest.fn(), {
        givenAt: 1,
      }),
    ).rejects.toBeInstanceOf(TrimOutOfLimitsError);
  });

  it("tolerates float drift from the trim bar at the limit", async () => {
    await expect(
      runDeidentify(remote(), { ...request, endSeconds: 25.004 }, jest.fn(), {
        givenAt: 1,
      }),
    ).resolves.toBeDefined();
  });
});

describe("runDeidentify prompts", () => {
  const tracker = () =>
    remote({ sendsFootageOffDevice: false, promptCount: 2 });
  const dancers = [
    { x: 0.4, y: 0.5 },
    { x: 0.6, y: 0.5 },
  ];

  it("refuses a tracking provider without a point per dancer", async () => {
    const provider = tracker();
    await expect(
      runDeidentify(provider, { ...request, prompts: [dancers[0]] }, jest.fn()),
    ).rejects.toBeInstanceOf(PromptsRequiredError);
    expect(provider.run).not.toHaveBeenCalled();
  });

  it("takes a single dancer from a provider that can follow one", async () => {
    const provider = remote({
      sendsFootageOffDevice: false,
      promptCount: 2,
      minPromptCount: 1,
    });
    await runDeidentify(
      provider,
      { ...request, prompts: [dancers[0]] },
      jest.fn(),
    );
    expect(provider.run).toHaveBeenCalled();
  });

  it("refuses more points than the provider can follow", async () => {
    const provider = remote({
      sendsFootageOffDevice: false,
      promptCount: 2,
      minPromptCount: 1,
    });
    await expect(
      runDeidentify(
        provider,
        { ...request, prompts: [...dancers, { x: 0.5, y: 0.2 }] },
        jest.fn(),
      ),
    ).rejects.toBeInstanceOf(PromptsRequiredError);
  });

  it("passes the points through once there is one per dancer", async () => {
    const provider = tracker();
    await runDeidentify(provider, { ...request, prompts: dancers }, jest.fn());
    expect(provider.run).toHaveBeenCalledWith(
      expect.objectContaining({ prompts: dancers }),
      expect.any(Function),
    );
  });

  it("refuses stray points for a provider that finds people itself", async () => {
    await expect(
      runDeidentify(
        remote({ sendsFootageOffDevice: false }),
        { ...request, prompts: dancers },
        jest.fn(),
      ),
    ).rejects.toBeInstanceOf(PromptsRequiredError);
  });
});

describe("availableProviders", () => {
  it("offers only providers that can run here", () => {
    const up = remote({ id: "up" });
    const down = remote({ id: "down", isAvailable: () => false });
    expect(availableProviders([up, down]).map((p) => p.id)).toEqual(["up"]);
  });
});
