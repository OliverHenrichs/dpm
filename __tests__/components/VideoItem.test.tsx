import React from "react";
import { useVideoPlayer } from "expo-video";
import { renderWithProviders, screen } from "@/utils/renderWithProviders";
import { VideoItem } from "@/src/common/components/VideoItem";
import ReelVideoView from "@/src/reels/components/ReelVideoView";

describe("VideoItem", () => {
  beforeEach(() => jest.mocked(useVideoPlayer).mockClear());

  it("plays a Vimeo link in Vimeo's player, with the hash an unlisted video needs", async () => {
    renderWithProviders(
      <VideoItem
        videoRef={{
          type: "url",
          value: "https://vimeo.com/76979871/8272103f6e",
          startTime: 30,
        }}
        width={320}
      />,
    );
    const player = await screen.UNSAFE_root.findByType("WebView" as never);
    expect(player.props.source).toEqual({
      uri: "https://player.vimeo.com/video/76979871?h=8272103f6e&playsinline=1#t=30s",
    });
    expect(useVideoPlayer).not.toHaveBeenCalled();
  });

  it("keeps the player from leaving for Vimeo's site", async () => {
    renderWithProviders(
      <VideoItem
        videoRef={{ type: "url", value: "https://vimeo.com/76979871" }}
        width={320}
      />,
    );
    const player = await screen.UNSAFE_root.findByType("WebView" as never);
    const allow = player.props.onShouldStartLoadWithRequest;
    expect(allow({ url: "https://player.vimeo.com/video/76979871" })).toBe(
      true,
    );
    expect(allow({ url: "https://vimeo.com/76979871" })).toBe(false);
  });

  it("plays a Dropbox link as the file, for links saved before they were rewritten", () => {
    renderWithProviders(
      <VideoItem
        videoRef={{
          type: "url",
          value: "https://www.dropbox.com/s/a/whip.mp4?dl=0",
        }}
        width={320}
      />,
    );
    expect(jest.mocked(useVideoPlayer).mock.calls[0][0]).toBe(
      "https://www.dropbox.com/s/a/whip.mp4?raw=1",
    );
  });

  it("plays a stream in the app's own player", () => {
    renderWithProviders(
      <VideoItem
        videoRef={{ type: "url", value: "https://cdn.example.com/a.m3u8" }}
        width={320}
      />,
    );
    expect(jest.mocked(useVideoPlayer).mock.calls[0][0]).toBe(
      "https://cdn.example.com/a.m3u8",
    );
  });
});

describe("ReelVideoView", () => {
  it("plays a Vimeo reel in Vimeo's player at the reel's size", async () => {
    renderWithProviders(
      <ReelVideoView
        video={{ type: "url", value: "https://vimeo.com/76979871" }}
        active
        width={360}
        height={640}
      />,
    );
    const player = await screen.UNSAFE_root.findByType("WebView" as never);
    expect(player.props.style).toEqual({ width: 360, height: 640 });
  });
});
