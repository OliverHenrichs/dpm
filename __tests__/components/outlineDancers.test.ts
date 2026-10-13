import {
  outlineDancers,
  prepareOutline,
  releaseOutline,
} from "@/src/anonymize/outlineDancers";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import { AnonymizeProvider } from "@/src/anonymize/providers/AnonymizeProvider";

jest.mock("@/src/transcribe/transcribeVideo", () => ({
  releaseTranscriptionContexts: jest.fn(async () => {}),
}));

const provider = (
  over: Partial<AnonymizeProvider> = {},
): AnonymizeProvider => ({
  id: "fake",
  labelKey: "anonymizeProviderTracking",
  minSeconds: 1,
  maxSeconds: 30,
  sendsFootageOffDevice: false,
  promptCount: 2,
  isAvailable: () => true,
  run: async () => ({ uri: "file:///out.mp4" }),
  outline: jest.fn(async () => ({ uri: "file:///o.jpg", found: [true] })),
  prepareOutline: jest.fn(async () => {}),
  releaseOutline: jest.fn(async () => {}),
  ...over,
});

const frame = { sourceUri: "file:///a.mp4", atSeconds: 2 };

describe("outlining the tapped dancers", () => {
  afterEach(() => jobStore.reset());

  it("prepares, outlines and releases through the provider", async () => {
    const p = provider();
    await prepareOutline(p, frame);
    const found = await outlineDancers(p, {
      ...frame,
      prompts: [{ x: 0.5, y: 0.5 }],
    });
    await releaseOutline(p);

    expect(p.prepareOutline).toHaveBeenCalledWith(frame);
    expect(found).toEqual({ uri: "file:///o.jpg", found: [true] });
    expect(p.releaseOutline).toHaveBeenCalled();
  });

  it("never outlines with a provider that sends footage off the device", async () => {
    const p = provider({ sendsFootageOffDevice: true });

    await expect(
      outlineDancers(p, { ...frame, prompts: [{ x: 0.5, y: 0.5 }] }),
    ).rejects.toThrow();
    await prepareOutline(p, frame);
    expect(p.outline).not.toHaveBeenCalled();
    expect(p.prepareOutline).not.toHaveBeenCalled();
  });

  it("does not load the model after the taps were left while it waited for a job", async () => {
    const p = provider();
    let finishJob: () => void = () => {};
    const job = jobStore.runExclusive(
      () => new Promise<void>((resolve) => (finishJob = resolve)),
    );

    const prepared = prepareOutline(p, frame);
    const outlined = outlineDancers(p, {
      ...frame,
      prompts: [{ x: 0.5, y: 0.5 }],
    });
    await releaseOutline(p);
    finishJob();
    await job;
    await prepared;
    await expect(outlined).rejects.toThrow();

    expect(p.prepareOutline).not.toHaveBeenCalled();
    expect(p.outline).not.toHaveBeenCalled();
  });
});
