import React from "react";
import { makeMutable } from "@/__mocks__/react-native-reanimated";
import {
  drawEdges,
  drawNodes,
} from "@/src/pattern/graph/render/GraphPrimitives";
import DraggedEdge from "@/src/pattern/graph/render/DraggedEdge";
import NetworkGraphSvg from "@/src/pattern/graph/GraphSvg";
import DraggedNode from "@/src/pattern/graph/render/DraggedNode";
import { buildGraphModel } from "@/src/pattern/graph/model/GraphModel";
import { getPalette } from "@/src/common/utils/ColorPalette";
import { render, screen } from "@testing-library/react-native";
import Svg, { G, Path } from "react-native-svg";
import { LayoutPosition } from "@/src/pattern/graph/utils/GraphUtils";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternType,
} from "@/utils/testFactories";

const TYPE = createTestPatternType({ slug: "push" });
const palette = getPalette("light");

const pattern = (id: number, prerequisites: number[] = []): IPattern =>
  createTestPattern(TYPE.id, { id, name: `P${id}`, prerequisites });

/** 1 → 2 → 3 */
const MODEL = buildGraphModel(
  [pattern(1), pattern(2, [1]), pattern(3, [2])],
  [TYPE],
);

const POSITIONS = new Map<number, LayoutPosition>([
  [1, { x: 0, y: 0 }],
  [2, { x: 200, y: 0 }],
  [3, { x: 400, y: 0 }],
]);

const drag = (draggingId: number | null) => ({
  draggingId,
  dragX: makeMutable(0),
  dragY: makeMutable(0),
});

/** `drawEdges` returns a fragment, so unwrap it before counting. */
const typesOf = (elements: React.ReactElement) =>
  React.Children.toArray(
    (elements.props as { children: React.ReactNode }).children,
  ).map((child) => (child as React.ReactElement).type);

/**
 * Which node and which edges become animated. Only the dragged node and the
 * edges touching it may, because everything that follows a shared value costs
 * a worklet per frame — the rest of the graph has to stay static however
 * large it is.
 */
describe("drawing during a drag", () => {
  describe("nodes", () => {
    it("animates only the node under the finger", () => {
      const rendered = drawNodes(
        MODEL.nodes,
        POSITIONS,
        palette,
        jest.fn(),
        drag(2),
      );

      const animated = rendered.filter((n) => n?.type === DraggedNode);
      expect(animated).toHaveLength(1);
    });

    it("animates nothing when no drag is in flight", () => {
      const rendered = drawNodes(MODEL.nodes, POSITIONS, palette, jest.fn(), {
        draggingId: null,
      });

      expect(rendered.some((n) => n?.type === DraggedNode)).toBe(false);
    });

    it("animates nothing when no drag state was passed at all", () => {
      // The timeline draws the same nodes and has no drag.
      const rendered = drawNodes(MODEL.nodes, POSITIONS, palette, jest.fn());

      expect(rendered.some((n) => n?.type === DraggedNode)).toBe(false);
    });

    it("still draws every node", () => {
      const rendered = drawNodes(
        MODEL.nodes,
        POSITIONS,
        palette,
        jest.fn(),
        drag(2),
      );

      expect(rendered.filter(Boolean)).toHaveLength(3);
    });
  });

  describe("edges", () => {
    it("animates both edges touching the dragged node", () => {
      // 2 is the middle of 1 → 2 → 3, so both edges move with it.
      const rendered = typesOf(
        drawEdges(MODEL.edges, POSITIONS, palette, drag(2)),
      );

      expect(rendered.filter((t) => t === DraggedEdge)).toHaveLength(2);
    });

    it("leaves an edge that does not touch it alone", () => {
      // Dragging 1 moves only 1 → 2; 2 → 3 is untouched.
      const rendered = typesOf(
        drawEdges(MODEL.edges, POSITIONS, palette, drag(1)),
      );

      expect(rendered.filter((t) => t === DraggedEdge)).toHaveLength(1);
    });

    it("animates nothing when no drag is in flight", () => {
      const rendered = typesOf(
        drawEdges(MODEL.edges, POSITIONS, palette, { draggingId: null }),
      );

      expect(rendered).not.toContain(DraggedEdge);
    });

    it("still draws every edge", () => {
      const rendered = typesOf(
        drawEdges(MODEL.edges, POSITIONS, palette, drag(2)),
      );

      expect(rendered).toHaveLength(MODEL.edges.length);
    });
  });
});

describe("whether a node claims touches", () => {
  /**
   * The crux of why long-press-to-drag did nothing on a node: `onPress` on an
   * SVG element installs React Native's Touchable responder set, whose
   * `onResponderTerminationRequest` refuses to yield, so the node took the
   * touch before Gesture Handler saw it. The network view must therefore draw
   * inert nodes and handle taps in the gesture system.
   */
  const groupProps = () => screen.UNSAFE_getAllByType(G).map((g) => g.props);

  it("claims nothing when no press handler is given", () => {
    render(<Svg>{drawNodes(MODEL.nodes, POSITIONS, palette, undefined)}</Svg>);

    expect(groupProps().every((props) => props.onPress === undefined)).toBe(
      true,
    );
  });

  it("draws the network view's nodes inert", () => {
    // The call site that matters: GraphSvg must not pass a press handler
    // down, whatever `onNodeTap` it was given for other purposes.
    render(
      <NetworkGraphSvg
        svgWidth={1000}
        svgHeight={1000}
        model={MODEL}
        positions={POSITIONS}
        palette={palette}
        onNodeTap={jest.fn()}
      />,
    );

    expect(groupProps().every((props) => props.onPress === undefined)).toBe(
      true,
    );
  });

  it("still claims touches when one is, for the timeline", () => {
    render(<Svg>{drawNodes(MODEL.nodes, POSITIONS, palette, jest.fn())}</Svg>);

    expect(groupProps().some((props) => props.onPress !== undefined)).toBe(
      true,
    );
  });
});

describe("what the animated elements compute", () => {
  const renderInSvg = (element: React.ReactElement) =>
    render(<Svg>{element}</Svg>);

  /** The node renders nested groups; only the outer one is animated. */
  const animatedGroupProps = () =>
    screen.UNSAFE_getAllByType(G).find((g) => g.props.animatedProps)?.props
      .animatedProps;

  describe("DraggedNode", () => {
    it("translates by how far the node has moved from where it started", () => {
      const dragX = makeMutable(250);
      const dragY = makeMutable(-40);

      renderInSvg(
        <DraggedNode
          node={MODEL.nodes[0]}
          origin={{ x: 100, y: 10 }}
          dragX={dragX}
          dragY={dragY}
          palette={palette}
          onPress={jest.fn()}
        />,
      );

      // Drawn at its original position inside a translating group, because
      // translate is the one thing that costs nothing per frame.
      expect(animatedGroupProps()).toEqual({
        translateX: 150,
        translateY: -50,
      });
    });

    it("does not move at all before the finger does", () => {
      const origin = { x: 100, y: 10 };

      renderInSvg(
        <DraggedNode
          node={MODEL.nodes[0]}
          origin={origin}
          dragX={makeMutable(origin.x)}
          dragY={makeMutable(origin.y)}
          palette={palette}
          onPress={jest.fn()}
        />,
      );

      expect(animatedGroupProps()).toEqual({ translateX: 0, translateY: 0 });
    });
  });

  describe("DraggedEdge", () => {
    const renderEdge = (draggingFrom: boolean) =>
      renderInSvg(
        <DraggedEdge
          anchor={{ x: 0, y: 0 }}
          dragX={makeMutable(400)}
          dragY={makeMutable(0)}
          draggingFrom={draggingFrom}
          elided={false}
          palette={palette}
        />,
      );

    it("rebuilds its path from the live position", () => {
      renderEdge(false);

      const path = screen.UNSAFE_getAllByType(Path)[0];
      expect(path.props.animatedProps.d).toMatch(/^M /);
    });

    it("draws in the opposite direction when the moving end is the source", () => {
      renderEdge(true);
      const fromMoving =
        screen.UNSAFE_getAllByType(Path)[0].props.animatedProps.d;
      screen.unmount();

      renderEdge(false);
      const toMoving =
        screen.UNSAFE_getAllByType(Path)[0].props.animatedProps.d;

      expect(fromMoving).not.toBe(toMoving);
    });

    it("dashes an elided edge, as the static renderer does", () => {
      renderInSvg(
        <DraggedEdge
          anchor={{ x: 0, y: 0 }}
          dragX={makeMutable(400)}
          dragY={makeMutable(0)}
          draggingFrom={false}
          elided
          palette={palette}
        />,
      );

      expect(
        screen.UNSAFE_getAllByType(Path)[0].props.strokeDasharray,
      ).toBeDefined();
    });
  });
});
