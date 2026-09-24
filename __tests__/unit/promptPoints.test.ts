import {
  containRect,
  tapToVideoPoint,
  videoPointToView,
} from "@/src/deidentify/model/promptPoints";

// A 16:9 landscape video in a 320x320 square view: letterboxed top and bottom (180 tall).
const view = { width: 320, height: 320 };
const video = { width: 1920, height: 1080 };

describe("promptPoints", () => {
  it("centres a contain-fitted video", () => {
    expect(containRect(view, video)).toEqual({
      x: 0,
      y: 70,
      width: 320,
      height: 180,
    });
  });

  it("pillarboxes a portrait video", () => {
    expect(containRect(view, { width: 1080, height: 1920 })).toEqual({
      x: 70,
      y: 0,
      width: 180,
      height: 320,
    });
  });

  it("maps a tap to a normalised point", () => {
    expect(tapToVideoPoint({ x: 160, y: 160 }, view, video)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(tapToVideoPoint({ x: 80, y: 115 }, view, video)).toEqual({
      x: 0.25,
      y: 0.25,
    });
  });

  it("ignores a tap in the letterbox bars", () => {
    expect(tapToVideoPoint({ x: 160, y: 20 }, view, video)).toBeNull();
    expect(tapToVideoPoint({ x: 160, y: 300 }, view, video)).toBeNull();
  });

  it("round-trips a point for the marker", () => {
    const tap = { x: 200, y: 100 };
    const point = tapToVideoPoint(tap, view, video)!;
    const back = videoPointToView(point, view, video);
    expect(back.x).toBeCloseTo(tap.x);
    expect(back.y).toBeCloseTo(tap.y);
  });

  it("has nothing to hit before sizes are known", () => {
    expect(
      tapToVideoPoint({ x: 1, y: 1 }, { width: 0, height: 0 }, video),
    ).toBeNull();
    expect(
      tapToVideoPoint({ x: 1, y: 1 }, view, { width: 0, height: 0 }),
    ).toBeNull();
  });
});
