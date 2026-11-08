import React, { useState } from "react";
import TrimWindowBar from "@/src/anonymize/components/TrimWindowBar";
import { TrimWindow } from "@/src/anonymize/model/trimWindow";
import {
  renderWithProviders,
  screen,
  fireEvent,
} from "@/utils/renderWithProviders";

const limits = { duration: 600, min: 1, max: 600 };

/** The bar over a 10 min clip, holding its own window as the panel does. */
function Harness({
  initial,
  onChangeEnd,
}: {
  initial: TrimWindow;
  onChangeEnd: jest.Mock;
}) {
  const [window, setWindow] = useState(initial);
  return (
    <TrimWindowBar
      limits={limits}
      window={window}
      onChange={setWindow}
      onChangeEnd={(w, grab) => {
        setWindow(w);
        onChangeEnd(w, grab);
      }}
    />
  );
}

function renderBar(initial: TrimWindow) {
  const onChangeEnd = jest.fn();
  renderWithProviders(<Harness initial={initial} onChangeEnd={onChangeEnd} />);
  fireEvent(screen.getByTestId("trim-track"), "layout", {
    nativeEvent: { layout: { width: 300, height: 44 } },
  });
  return { onChangeEnd };
}

const button = (name: string) => screen.getByRole("button", { name });
/** The selection's drawn width on the 300 px track. */
const drawnWidth = () => {
  const style = [screen.getByTestId("trim-window").props.style].flat(3);
  return style.find((s) => s && "width" in s).width as number;
};

describe("TrimWindowBar", () => {
  it("offers no zoom while the selection is most of the clip", () => {
    renderBar({ start: 0, end: 600 });

    expect(screen.queryByTestId("trim-zoom")).toBeNull();
  });

  it("zooms in on a short selection, then shows the whole clip again", () => {
    renderBar({ start: 100, end: 110 });
    expect(drawnWidth()).toBeCloseTo(5);

    fireEvent.press(button("Zoom in on the selection"));

    // 90–120 s on 300 px: the 10 s selection is a third of the bar.
    expect(drawnWidth()).toBeCloseTo(100);
    expect(screen.getByTestId("trim-zoom-edges")).toHaveTextContent("1:302:00");

    fireEvent.press(button("Show the whole video"));

    expect(drawnWidth()).toBeCloseTo(5);
    expect(screen.queryByTestId("trim-zoom-edges")).toBeNull();
  });

  it("re-centres the zoomed bar once a step takes the selection off it", () => {
    renderBar({ start: 100, end: 110 });
    fireEvent.press(button("Zoom in on the selection"));

    // Moving the whole window 1 s at a time, the way a screen reader does.
    for (let i = 0; i < 11; i++) {
      fireEvent(screen.getByTestId("trim-track"), "accessibilityAction", {
        nativeEvent: { actionName: "increment" },
      });
    }

    // 111–121 s left 90–120 s; the bar now spans 101–131 s.
    expect(screen.getByTestId("trim-zoom-edges")).toHaveTextContent("1:412:11");
  });

  it("steps each end by a tenth and reports which end moved", () => {
    const { onChangeEnd } = renderBar({ start: 100, end: 110 });

    fireEvent.press(button("Start 0.1 s earlier"));
    expect(onChangeEnd).toHaveBeenLastCalledWith(
      { start: expect.closeTo(99.9), end: 110 },
      "start",
    );
    fireEvent.press(button("End 0.1 s later"));
    expect(onChangeEnd).toHaveBeenLastCalledWith(
      { start: expect.closeTo(99.9), end: expect.closeTo(110.1) },
      "end",
    );
    expect(screen.getByTestId("trim-start")).toHaveTextContent("1:39.9");
    expect(screen.getByTestId("trim-end")).toHaveTextContent("1:50.1");
  });
});
