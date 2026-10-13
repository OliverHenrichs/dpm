const mockAnonymize = jest.fn();

jest.mock("@/modules/video-anonymize", () => ({
  isAnonymizeAvailable: true,
  VideoAnonymizeModule: {
    anonymize: (...args: unknown[]) => mockAnonymize(...args),
    addListener: () => ({ remove: jest.fn() }),
  },
}));

import {
  onDeviceFaces,
  onDeviceTracking,
} from "@/src/anonymize/providers/onDeviceTracking";
import { ALL_PROVIDERS } from "@/src/anonymize/providers/allProviders";

describe("on-device anonymize providers", () => {
  beforeEach(() => mockAnonymize.mockResolvedValue({ uri: "file:///out.mp4" }));

  it.each([
    ["Silhouettes", onDeviceTracking, "silhouette"],
    ["Faces only", onDeviceFaces, "faces"],
  ])("%s renders in its own mode", async (_, provider, mode) => {
    await provider.run(
      {
        sourceUri: "file:///in.mp4",
        startSeconds: 2,
        endSeconds: 8,
        prompts: [{ x: 0.25, y: 0.5 }],
      },
      jest.fn(),
    );
    expect(mockAnonymize).toHaveBeenLastCalledWith(
      "file:///in.mp4",
      expect.objectContaining({
        mode,
        startSeconds: 2,
        endSeconds: 8,
        prompts: [[0.25, 0.5]],
      }),
    );
  });

  it("offers silhouettes first, as the default", () => {
    expect(ALL_PROVIDERS.map((p) => p.id)).toEqual([
      "on-device-tracking",
      "on-device-faces",
    ]);
  });
});
