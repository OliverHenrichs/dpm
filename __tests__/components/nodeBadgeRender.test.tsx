import React from "react";
import { render, screen } from "@testing-library/react-native";
import Svg, { Circle, Path } from "react-native-svg";
import PatternNode from "@/src/pattern/graph/PatternNode";
import { buildGraphModel } from "@/src/pattern/graph/model/GraphModel";
import { getPalette } from "@/src/common/utils/ColorPalette";
import {
  IPattern,
  IPatternModifierRef,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { NODE_HEIGHT, NODE_WIDTH } from "@/src/pattern/graph/types/Constants";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push", color: "#FF0000" });
const palette = getPalette("light");
const CENTRE = { x: 200, y: 150 };
/** Mirrors the renderer; the point of the tests below is that it is uniform. */
const BADGE_INSET = 3;
const DOT_RADIUS = 2;

const video = (): IVideoReference => ({
  type: "url",
  value: "https://example.test/clip",
});

const modifierRef = (
  modifierId: string,
  videoRefs: IVideoReference[] = [],
): IPatternModifierRef => ({ modifierId, videoRefs });

function renderNode(overrides: Partial<IPattern> = {}) {
  const pattern = createTestPattern(TYPE.id, {
    id: 1,
    name: "Whip",
    ...overrides,
  });
  const model = buildGraphModel([pattern], [TYPE]);
  render(
    <Svg>
      <PatternNode
        node={model.nodes[0]}
        x={CENTRE.x}
        y={CENTRE.y}
        palette={palette}
      />
    </Svg>,
  );
}

/** The play triangle; the node draws no other Path. */
const videoBadge = () => screen.UNSAFE_queryAllByType(Path);
const modifierDots = () => screen.UNSAFE_queryAllByType(Circle);

/** The triangle's corners, pulled back out of its path string. */
function trianglePoints(): { xs: number[]; ys: number[] } {
  const numbers = String(videoBadge()[0].props.d)
    .split(/[MLZ ]+/)
    .filter(Boolean)
    .map(Number);
  return {
    xs: numbers.filter((_, index) => index % 2 === 0),
    ys: numbers.filter((_, index) => index % 2 === 1),
  };
}

describe("node badges", () => {
  describe("what gets drawn", () => {
    it("draws nothing on a bare pattern", () => {
      renderNode();

      expect(videoBadge()).toHaveLength(0);
      expect(modifierDots()).toHaveLength(0);
    });

    it("marks a pattern with its own video", () => {
      renderNode({ videoRefs: [video()] });

      expect(videoBadge()).toHaveLength(1);
    });

    it("marks a pattern whose video hangs off a modifier combination", () => {
      renderNode({ modifierRefs: [modifierRef("a", [video()])] });

      expect(videoBadge()).toHaveLength(1);
    });

    it("draws one dot per attached modifier", () => {
      renderNode({
        modifierRefs: [modifierRef("a"), modifierRef("b")],
      });

      expect(modifierDots()).toHaveLength(2);
    });

    it("caps the dots rather than overflowing the node", () => {
      renderNode({
        modifierRefs: ["a", "b", "c", "d", "e"].map((id) => modifierRef(id)),
      });

      expect(modifierDots()).toHaveLength(3);
    });

    it("draws both marks together", () => {
      renderNode({
        videoRefs: [video()],
        modifierRefs: [modifierRef("a")],
      });

      expect(videoBadge()).toHaveLength(1);
      expect(modifierDots()).toHaveLength(1);
    });
  });

  describe("where they go", () => {
    /**
     * `NODE_WIDTH` and `NODE_HEIGHT` feed the timeline's swimlane sizing and
     * its collision-avoidance pass, so node size is not a free variable. The
     * badges have to live inside the existing box.
     */
    const withinNode = (px: number, py: number) =>
      Math.abs(px - CENTRE.x) <= NODE_WIDTH / 2 &&
      Math.abs(py - CENTRE.y) <= NODE_HEIGHT / 2;

    it("keeps the dots inside the node box", () => {
      renderNode({
        modifierRefs: ["a", "b", "c"].map((id) => modifierRef(id)),
        videoRefs: [video()],
      });

      for (const dot of modifierDots()) {
        expect(withinNode(dot.props.cx, dot.props.cy)).toBe(true);
      }
    });

    it("keeps the video mark inside the node box", () => {
      renderNode({ videoRefs: [video()] });
      const { xs, ys } = trianglePoints();

      for (let i = 0; i < xs.length; i++) {
        expect(withinNode(xs[i], ys[i])).toBe(true);
      }
    });

    /**
     * The gaps have to be measured the same way on both axes — the outside of
     * the shape, not the centre on one and the edge on the other. Getting
     * that wrong is invisible in a "is it inside the box" assertion and very
     * visible on a device: the mark sat 7px from the right and 3px from the
     * bottom.
     */
    it("sits the same distance from the right edge as from the bottom", () => {
      renderNode({ videoRefs: [video()] });
      const { xs, ys } = trianglePoints();

      const gapRight = CENTRE.x + NODE_WIDTH / 2 - Math.max(...xs);
      const gapBottom = CENTRE.y + NODE_HEIGHT / 2 - Math.max(...ys);

      expect(gapRight).toBe(gapBottom);
    });

    it("sits the video mark close to the corner, not floating in it", () => {
      renderNode({ videoRefs: [video()] });
      const { xs, ys } = trianglePoints();

      expect(CENTRE.x + NODE_WIDTH / 2 - Math.max(...xs)).toBe(BADGE_INSET);
      expect(CENTRE.y + NODE_HEIGHT / 2 - Math.max(...ys)).toBe(BADGE_INSET);
    });

    /**
     * Alone, the dots take the corner themselves. Sharing the triangle's
     * centre line when there is no triangle would hang them its height above
     * the bottom edge with nothing beneath — the same lopsidedness the video
     * mark had, from the other side.
     */
    it("sits a lone dot row the same distance from both edges", () => {
      renderNode({ modifierRefs: [modifierRef("a")] });
      const dot = modifierDots()[0];

      const gapRight = CENTRE.x + NODE_WIDTH / 2 - (dot.props.cx + DOT_RADIUS);
      const gapBottom =
        CENTRE.y + NODE_HEIGHT / 2 - (dot.props.cy + DOT_RADIUS);

      expect(gapRight).toBe(gapBottom);
      expect(gapRight).toBe(BADGE_INSET);
    });

    it("lines the dots up with the video mark when both are drawn", () => {
      renderNode({
        videoRefs: [video()],
        modifierRefs: [modifierRef("a"), modifierRef("b")],
      });
      const { ys } = trianglePoints();
      const playCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;

      for (const dot of modifierDots()) {
        expect(dot.props.cy).toBe(playCenterY);
      }
    });

    it("puts the dots clear of the video mark", () => {
      renderNode({
        videoRefs: [video()],
        modifierRefs: [modifierRef("a")],
      });

      const dot = modifierDots()[0];

      expect(dot.props.cx).toBeLessThan(Math.max(...trianglePoints().xs));
    });
  });

  describe("how they read", () => {
    it("uses the pattern type's colour, not a grey that would wash out", () => {
      // The node's fill opacity already varies by level (0.3 / 0.5 / 0.7).
      renderNode({ videoRefs: [video()], level: "advanced" });

      expect(videoBadge()[0].props.fill).toBe("#FF0000");
    });
  });
});
