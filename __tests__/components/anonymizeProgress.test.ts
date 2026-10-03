import { overallFraction } from "@/src/anonymize/providers/onDeviceTracking";

describe("anonymize progress", () => {
  it("counts to 100% once over both stages", () => {
    const seen = [
      overallFraction("transcode", 0),
      overallFraction("transcode", 1),
      overallFraction("silhouette", 0),
      overallFraction("silhouette", 0.5),
      overallFraction("silhouette", 1),
    ];
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBeCloseTo(1);
    seen.slice(1).forEach((f, i) => expect(f).toBeGreaterThanOrEqual(seen[i]));
    // The fast transcode is a sliver of the whole, not the first 100%.
    expect(seen[1]).toBeLessThan(0.1);
  });

  it("passes an unknown stage through, clamped", () => {
    expect(overallFraction("mystery", 0.4)).toBe(0.4);
    expect(overallFraction("silhouette", 2)).toBeCloseTo(1);
  });
});
