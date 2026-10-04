import React from "react";
import PatternVideos from "@/src/pattern/list/PatternVideos";
import {
  IGeneratedVideo,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import {
  fireEvent,
  renderWithProviders,
  screen,
} from "@/utils/renderWithProviders";

const url = (value: string, startTime?: number): IVideoReference => ({
  type: "url",
  value,
  ...(startTime !== undefined && { startTime }),
});
const local = (
  value: string,
  generated?: IGeneratedVideo,
): IVideoReference => ({
  type: "local",
  value,
  ...(generated && { generated }),
});

const GENERATED: IGeneratedVideo = { method: "silhouette", createdAt: 0 };

function renderVideos(
  props: Partial<React.ComponentProps<typeof PatternVideos>> = {},
) {
  const handlers = {
    onAddVideo: jest.fn(),
    onRemoveVideo: jest.fn(),
  };
  renderWithProviders(
    <PatternVideos videoRefs={[]} thumbnails={[]} {...handlers} {...props} />,
  );
  return handlers;
}

describe("PatternVideos", () => {
  it("shows a placeholder for an online video without a thumbnail, with its start time", () => {
    renderVideos({
      videoRefs: [
        url("https://example.com/a"),
        url("https://example.com/b", 75),
      ],
      thumbnails: ["", ""],
    });

    expect(screen.getByText("Online")).toBeOnTheScreen();
    expect(screen.getByText("1:15")).toBeOnTheScreen();
  });

  it("shows a thumbnail when there is one, and says so when there is none", () => {
    renderVideos({
      videoRefs: [
        url("https://youtu.be/x"),
        local("file:///a.mp4"),
        local("file:///b.mp4"),
      ],
      thumbnails: ["https://img.youtube.com/x.jpg", "file:///a.jpg", ""],
    });

    expect(screen.getByText("No preview")).toBeOnTheScreen();
    expect(screen.queryByText("Online")).toBeNull();
  });

  it("marks an anonymized video, and only that one", () => {
    renderVideos({
      videoRefs: [
        local("file:///plain.mp4"),
        local("file:///s.mp4", GENERATED),
      ],
      thumbnails: ["file:///plain.jpg", "file:///s.jpg"],
    });

    expect(screen.getAllByLabelText("Anonymized")).toHaveLength(1);
  });

  it("removes the video whose button is pressed", () => {
    const { onRemoveVideo } = renderVideos({
      videoRefs: [local("file:///a.mp4"), local("file:///b.mp4")],
      thumbnails: ["", ""],
    });

    fireEvent.press(screen.getAllByLabelText("Remove video from pattern")[1]);
    expect(onRemoveVideo).toHaveBeenCalledWith(1);
  });

  it("offers the video editor only when given one", () => {
    const onEditVideo = jest.fn();
    renderVideos();
    expect(screen.queryByLabelText("Edit a video")).toBeNull();

    screen.unmount();
    renderVideos({ onEditVideo });
    fireEvent.press(screen.getByLabelText("Edit a video"));
    expect(onEditVideo).toHaveBeenCalled();
  });

  it("adds a video, unless disabled", () => {
    const { onAddVideo } = renderVideos();
    fireEvent.press(screen.getByLabelText("Add"));
    expect(onAddVideo).toHaveBeenCalledTimes(1);

    screen.unmount();
    const disabled = renderVideos({ disabled: true });
    fireEvent.press(screen.getByLabelText("Add"));
    expect(disabled.onAddVideo).not.toHaveBeenCalled();
  });
});
