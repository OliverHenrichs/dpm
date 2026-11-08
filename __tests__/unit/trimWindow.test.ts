import {
  canTrim,
  canZoom,
  decimalMark,
  dragWindow,
  fitWindow,
  formatLength,
  formatSeconds,
  formatTenths,
  fullView,
  grabbedTime,
  hitTest,
  initialWindow,
  moveWindow,
  resizeEnd,
  resizeStart,
  showsWindow,
  TrimLimits,
  zoomView,
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
    const hit = (x: number, w = window) => hitTest(x, w, 600, fullView(60), 28);

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
      expect(hitTest(100, window, 0, fullView(60), 28)).toBeNull();
    });

    it("measures from the start of a zoomed-in view", () => {
      // 600 px over 8–14 s: 100 px per second; the window 10–12 s spans 200–400 px.
      const view = { from: 8, to: 14 };
      const short = { start: 10, end: 12 };
      expect(hitTest(210, short, 600, view, 28)).toBe("start");
      expect(hitTest(300, short, 600, view, 28)).toBe("move");
      expect(hitTest(395, short, 600, view, 28)).toBe("end");
    });
  });

  describe("zoomView", () => {
    it("centres the selection with its own length on either side", () => {
      expect(zoomView({ start: 100, end: 110 }, 600)).toEqual({
        from: 90,
        to: 120,
      });
    });

    it("keeps at least 2 s either side of a very short selection", () => {
      expect(zoomView({ start: 100, end: 101 }, 600)).toEqual({
        from: 98,
        to: 103,
      });
    });

    it("shifts rather than cuts at the ends of the clip", () => {
      expect(zoomView({ start: 1, end: 6 }, 600)).toEqual({ from: 0, to: 15 });
      expect(zoomView({ start: 595, end: 600 }, 600)).toEqual({
        from: 585,
        to: 600,
      });
    });

    it("is offered only where it is at most half the clip", () => {
      expect(canZoom({ start: 100, end: 110 }, 600)).toBe(true);
      expect(canZoom({ start: 0, end: 20 }, 60)).toBe(false);
      expect(canZoom({ start: 0, end: 0 }, 0)).toBe(false);
    });

    it("knows when the selection has left the view", () => {
      const view = { from: 90, to: 120 };
      expect(showsWindow(view, { start: 90, end: 120 })).toBe(true);
      expect(showsWindow(view, { start: 95, end: 125 })).toBe(false);
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

  it("shows the end's frame for the end grip, the start's otherwise", () => {
    const w = { start: 4, end: 9 };
    expect(grabbedTime(w, "start")).toBe(4);
    expect(grabbedTime(w, "move")).toBe(4);
    expect(grabbedTime(w, "end")).toBe(9);
  });

  it("formats times to the tenth with the language's decimal mark", () => {
    expect(formatTenths(65.34)).toBe("1:05.3");
    expect(formatTenths(59.96)).toBe("1:00.0");
    expect(formatTenths(3.25, ",")).toBe("0:03,3");
    expect(formatTenths(-1)).toBe("0:00.0");
  });

  it("formats a length in tenths below 10 s and whole seconds above", () => {
    expect(formatLength(1.44)).toBe("1.4");
    expect(formatLength(2.0)).toBe("2");
    expect(formatLength(2.46, ",")).toBe("2,5");
    expect(formatLength(9.96)).toBe("10");
    expect(formatLength(18.4)).toBe("18");
  });

  it("finds the decimal mark of a language", () => {
    expect(decimalMark("en")).toBe(".");
    expect(decimalMark("de")).toBe(",");
  });

  it("formats seconds as m:ss", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(65.4)).toBe("1:05");
    expect(formatSeconds(-2)).toBe("0:00");
  });
});
