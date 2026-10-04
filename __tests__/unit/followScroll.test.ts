import { followScrollTarget } from "@/src/transcribe/followScroll";

describe("followScrollTarget", () => {
  const viewport = { y: 100, height: 200 };

  it("leaves a fully visible line where it is", () => {
    expect(followScrollTarget({ y: 150, height: 40 }, viewport, 1000)).toBe(
      null,
    );
  });

  it("brings a line below the window up near the top", () => {
    expect(followScrollTarget({ y: 400, height: 40 }, viewport, 1000)).toBe(
      376,
    );
  });

  it("brings a line cut off at the bottom into view", () => {
    expect(followScrollTarget({ y: 280, height: 40 }, viewport, 1000)).toBe(
      256,
    );
  });

  it("scrolls back up to a line above the window", () => {
    expect(followScrollTarget({ y: 10, height: 40 }, viewport, 1000)).toBe(0);
  });

  it("never scrolls past the end of the content", () => {
    expect(followScrollTarget({ y: 950, height: 40 }, viewport, 1000)).toBe(
      800,
    );
  });
});
