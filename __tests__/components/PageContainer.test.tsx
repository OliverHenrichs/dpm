import React from "react";
import { Text, View } from "react-native";
import PageContainer from "@/src/common/components/PageContainer";
import { SCREEN_EDGE_INSET } from "@/src/common/utils/EdgeInsets";
import { renderWithProviders, screen } from "@/utils/renderWithProviders";

const flatten = (style: unknown): Record<string, unknown> =>
  (Array.isArray(style) ? style.flat(Infinity) : [style])
    .filter(Boolean)
    .reduce<Record<string, unknown>>(
      (merged, part) => ({ ...merged, ...(part as object) }),
      {},
    );

const containerStyle = () =>
  flatten(
    screen
      .UNSAFE_getAllByType(View)
      .find((node) => flatten(node.props.style).flex === 1)!.props.style,
  );

describe("PageContainer", () => {
  it("renders what it is given", () => {
    renderWithProviders(
      <PageContainer>
        <Text>content</Text>
      </PageContainer>,
    );

    expect(screen.getByText("content")).toBeOnTheScreen();
  });

  /**
   * Android 10+ binds the system back gesture to both screen edges and takes
   * roughly the outer 20 dp. Every screen wraps in this, so this padding is
   * what keeps the timeline's scroller, the graph's pan and the video
   * carousel out of that band — the alternative is each of them remembering
   * to pad itself.
   */
  it("holds content clear of the system gesture band at both edges", () => {
    renderWithProviders(
      <PageContainer>
        <Text>content</Text>
      </PageContainer>,
    );

    expect(containerStyle().paddingHorizontal).toBe(SCREEN_EDGE_INSET);
    expect(SCREEN_EDGE_INSET).toBeGreaterThanOrEqual(16);
  });

  it("does not waste the same space vertically", () => {
    // There is no system gesture along the top and bottom to avoid.
    renderWithProviders(
      <PageContainer>
        <Text>content</Text>
      </PageContainer>,
    );

    expect(containerStyle().paddingVertical).toBeLessThan(SCREEN_EDGE_INSET);
  });

  it("lets a caller add to its style without losing the inset", () => {
    renderWithProviders(
      <PageContainer style={{ backgroundColor: "#123456" }}>
        <Text>content</Text>
      </PageContainer>,
    );

    expect(containerStyle().paddingHorizontal).toBe(SCREEN_EDGE_INSET);
    expect(containerStyle().backgroundColor).toBe("#123456");
  });
});
