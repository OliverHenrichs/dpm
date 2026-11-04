import { renderHook } from "@testing-library/react-native";
import {
  laneTop,
  useLaneMotion,
} from "@/src/pattern/graph/hooks/useLaneMotion";

type Lanes = { typeId: string; y: number }[];

/**
 * The mock plays no animation: a slide lands at once. What is held here is where each lane
 * starts and ends, and that a new layout never moves a lane before its slide begins.
 */
describe("useLaneMotion", () => {
  const mount = (lanes: Lanes) =>
    renderHook(({ lanes }: { lanes: Lanes }) => useLaneMotion(lanes), {
      initialProps: { lanes },
    });

  it("puts each lane at its laid-out top", () => {
    const { result } = mount([
      { typeId: "push", y: 0 },
      { typeId: "pass", y: 120 },
    ]);
    expect(laneTop(result.current, "push", -1)).toBe(0);
    expect(laneTop(result.current, "pass", -1)).toBe(120);
  });

  it("slides lanes to their new tops when the order changes", () => {
    const { result, rerender } = mount([
      { typeId: "push", y: 0 },
      { typeId: "pass", y: 120 },
    ]);
    rerender({
      lanes: [
        { typeId: "pass", y: 0 },
        { typeId: "push", y: 100 },
      ],
    });
    const motion = result.current;
    expect(motion.from.get()).toEqual({ push: 0, pass: 120 });
    expect(motion.to.get()).toEqual({ pass: 0, push: 100 });
    expect(laneTop(motion, "push", -1)).toBe(100);
    expect(laneTop(motion, "pass", -1)).toBe(0);
  });

  it("starts a slide from wherever the lane is mid-way", () => {
    const { result, rerender } = mount([{ typeId: "push", y: 0 }]);
    rerender({ lanes: [{ typeId: "push", y: 100 }] });
    result.current.progress.set(0.5);
    rerender({ lanes: [{ typeId: "push", y: 300 }] });
    expect(result.current.from.get()).toEqual({ push: 50 });
    expect(result.current.to.get()).toEqual({ push: 300 });
  });

  it("puts a lane that has just appeared in place, without a slide", () => {
    const { result, rerender } = mount([{ typeId: "push", y: 0 }]);
    // Before the layout reaches the hook, a new lane sits where it was laid out.
    expect(laneTop(result.current, "whip", 80)).toBe(80);
    rerender({
      lanes: [
        { typeId: "push", y: 0 },
        { typeId: "whip", y: 80 },
      ],
    });
    expect(result.current.from.get()).toEqual({ push: 0 });
    expect(laneTop(result.current, "whip", -1)).toBe(80);
  });
});
