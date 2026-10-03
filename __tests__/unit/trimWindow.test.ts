import {
  canTrim,
  dragWindow,
  fitWindow,
  formatSeconds,
  hitTest,
  initialWindow,
  moveWindow,
  resizeEnd,
  resizeStart,
  TrimLimits,
} from "@/src/anonymize/model/trimWindow";

const limits: TrimLimits = { duration: 60, min: 1, max: 30 };

describe("trimWindow", () => {
  describe("initialWindow", () => {
    it("starts at 0 and is as long as the limit allows", () => {
      expect(initialWindow(limits)).toEqual({ start: 0, end: 30 });
    });

    it("covers a clip shorter than the limit entirely", () => {
      expect(initialWindow({ ...limits, duration: 12 })).toEqual({
        start: 0,
        end: 12,
      });
    });
  });

  describe("canTrim", () => {
    it("rejects a clip shorter than the provider's minimum", () => {
      expect(canTrim({ duration: 4, min: 5, max: 15 })).toBe(false);
      expect(canTrim({ duration: 5, min: 5, max: 15 })).toBe(true);
    });

    it("rejects an empty clip", () => {
      expect(canTrim({ duration: 0, min: 0, max: 30 })).toBe(false);
    });
  });

  describe("moveWindow", () => {
    it("keeps the length while moving", () => {
      expect(moveWindow({ start: 10, end: 25 }, 5, limits)).toEqual({
        start: 15,
        end: 30,
      });
    });

    it("stops at the end of the clip", () => {
      expect(moveWindow({ start: 20, end: 50 }, 30, limits)).toEqual({
        start: 30,
        end: 60,
      });
    });

    it("stops at the start of the clip", () => {
      expect(moveWindow({ start: 5, end: 20 }, -30, limits)).toEqual({
        start: 0,
        end: 15,
      });
    });
  });

  describe("resizeStart", () => {
    it("moves only the start", () => {
      expect(resizeStart({ start: 10, end: 30 }, 15, limits)).toEqual({
        start: 15,
        end: 30,
      });
    });

    it("cannot make the window longer than the maximum", () => {
      expect(resizeStart({ start: 20, end: 40 }, 0, limits)).toEqual({
        start: 10,
        end: 40,
      });
    });

    it("cannot make the window shorter than the minimum", () => {
      expect(resizeStart({ start: 10, end: 20 }, 25, limits)).toEqual({
        start: 19,
        end: 20,
      });
    });

    it("cannot go before the clip", () => {
      expect(resizeStart({ start: 5, end: 20 }, -3, limits)).toEqual({
        start: 0,
        end: 20,
      });
    });
  });

  describe("resizeEnd", () => {
    it("cannot make the window longer than the maximum", () => {
      expect(resizeEnd({ start: 10, end: 20 }, 55, limits)).toEqual({
        start: 10,
        end: 40,
      });
    });

    it("cannot go past the clip", () => {
      expect(resizeEnd({ start: 40, end: 50 }, 70, limits)).toEqual({
        start: 40,
        end: 60,
      });
    });

    it("cannot make the window shorter than the minimum", () => {
      expect(resizeEnd({ start: 10, end: 20 }, 5, limits)).toEqual({
        start: 10,
        end: 11,
      });
    });
  });

  describe("fitWindow", () => {
    it("shortens a 30 s window to a 15 s provider limit, keeping the start", () => {
      expect(
        fitWindow({ start: 10, end: 40 }, { duration: 60, min: 5, max: 15 }),
      ).toEqual({ start: 10, end: 25 });
    });

    it("grows a window below the new minimum", () => {
      expect(
        fitWindow({ start: 10, end: 12 }, { duration: 60, min: 5, max: 15 }),
      ).toEqual({ start: 10, end: 15 });
    });

    it("pulls the window back inside the clip when growing it would overrun", () => {
      expect(
        fitWindow({ start: 58, end: 60 }, { duration: 60, min: 5, max: 15 }),
      ).toEqual({ start: 55, end: 60 });
    });
  });

  describe("hitTest", () => {
    // 600 px track over a 60 s clip: 10 px per second; the window spans 100–300 px.
    const window = { start: 10, end: 30 };
    const hit = (x: number, w = window) => hitTest(x, w, 600, 60, 28);

    it("grabs the start grip near the left edge, from either side", () => {
      expect(hit(80)).toBe("start");
      expect(hit(120)).toBe("start");
    });

    it("grabs the end grip near the right edge", () => {
      expect(hit(310)).toBe("end");
    });

    it("moves the window when grabbed in the middle", () => {
      expect(hit(200)).toBe("move");
    });

    it("grabs nothing outside the window and its grips", () => {
      expect(hit(20)).toBeNull();
      expect(hit(500)).toBeNull();
    });

    it("picks the nearer grip when a short window puts both in reach", () => {
      const short = { start: 10, end: 13 }; // 100–130 px
      expect(hit(104, short)).toBe("start");
      expect(hit(127, short)).toBe("end");
    });

    it("grabs nothing before the track is measured", () => {
      expect(hitTest(100, window, 0, 60, 28)).toBeNull();
    });
  });

  describe("dragWindow", () => {
    const origin = { start: 10, end: 30 };

    it("dispatches each grab to its operation", () => {
      expect(dragWindow(origin, "move", 5, limits)).toEqual({
        start: 15,
        end: 35,
      });
      expect(dragWindow(origin, "start", 5, limits)).toEqual({
        start: 15,
        end: 30,
      });
      expect(dragWindow(origin, "end", 5, limits)).toEqual({
        start: 10,
        end: 35,
      });
    });
  });

  it("formats seconds as m:ss", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65.4)).toBe("1:05");
    expect(formatSeconds(-2)).toBe("0:00");
  });
});
