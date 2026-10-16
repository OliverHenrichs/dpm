import { awaitingLink } from "@/src/videoLinks/awaitingLink";
import { readSharedContent } from "@/src/videoLinks/sharedContent";
import {
  findWebUrl,
  isWebUrl,
  linkedVideo,
  playsInApp,
  videoMimeType,
} from "@/src/videoLinks/videoLinks";
import { IVideoTranscript } from "@/src/pattern/types/IPatternList";

const TRANSCRIPT: IVideoTranscript = {
  language: "en",
  model: "whisper-base-q5_1",
  createdAt: 1,
  segments: [{ start: 0, end: 2, text: "Anchor." }],
};

describe("isWebUrl", () => {
  it.each([
    "https://youtu.be/abc123",
    "http://example.com/clip.mp4",
    "  https://youtube.com/shorts/abc  ",
  ])("accepts %s", (url) => expect(isWebUrl(url)).toBe(true));

  it.each([
    "",
    "youtu.be/abc123",
    "ftp://example.com/clip.mp4",
    "https://",
    "https://youtu.be/abc and more",
    "file:///document/video.mp4",
  ])("refuses %j", (url) => expect(isWebUrl(url)).toBe(false));
});

describe("findWebUrl", () => {
  it("finds the link inside the words an app shares around it", () => {
    expect(
      findWebUrl('Watch "Whip" on YouTube: https://youtu.be/abc123?si=x1.'),
    ).toBe("https://youtu.be/abc123?si=x1");
  });

  it("takes the first of several links", () => {
    expect(findWebUrl("https://a.example/1 https://b.example/2")).toBe(
      "https://a.example/1",
    );
  });

  it("finds nothing in text without a link", () => {
    expect(findWebUrl("Great class tonight!")).toBeNull();
    expect(findWebUrl(null)).toBeNull();
  });
});

describe("linkedVideo", () => {
  it("turns a local video into a link that keeps its transcript and provenance", () => {
    const generated = { method: "tracking" as const, createdAt: 5 };
    expect(
      linkedVideo(
        {
          type: "local",
          value: "file:///document/a.mp4",
          transcript: TRANSCRIPT,
          generated,
        },
        " https://youtu.be/abc123 ",
      ),
    ).toEqual({
      type: "url",
      value: "https://youtu.be/abc123",
      transcript: TRANSCRIPT,
      generated,
    });
  });

  it("adds no keys the video did not have (Firestore rejects undefined)", () => {
    expect(
      linkedVideo({ type: "local", value: "a.mp4" }, "https://youtu.be/x"),
    ).toEqual({ type: "url", value: "https://youtu.be/x" });
  });
});

describe("readSharedContent", () => {
  it("reads a shared link", () => {
    expect(
      readSharedContent({ text: "Look: https://youtu.be/abc", webUrl: null }),
    ).toEqual({ kind: "link", url: "https://youtu.be/abc" });
  });

  it("takes a shared Dropbox link as the file it points at", () => {
    expect(
      readSharedContent({ text: "https://www.dropbox.com/s/a/whip.mp4?dl=0" }),
    ).toEqual({
      kind: "link",
      url: "https://www.dropbox.com/s/a/whip.mp4?raw=1",
    });
  });

  it("prefers a video file over the caption shared with it", () => {
    expect(
      readSharedContent({
        text: "https://example.com",
        files: [
          { path: "file:///cache/photo.jpg", mimeType: "image/jpeg" },
          { path: "file:///cache/clip.mp4", mimeType: "video/mp4" },
        ],
      }),
    ).toEqual({ kind: "video", uri: "file:///cache/clip.mp4" });
  });

  it("has no use for text without a link, or for other files", () => {
    expect(readSharedContent({ text: "Hello" })).toEqual({ kind: "unusable" });
    expect(
      readSharedContent({
        files: [
          { path: "file:///cache/notes.pdf", mimeType: "application/pdf" },
        ],
      }),
    ).toEqual({ kind: "unusable" });
  });
});

describe("videoMimeType", () => {
  it("names the type by extension, and any video otherwise", () => {
    expect(videoMimeType("file:///document/video-1.mp4")).toBe("video/mp4");
    expect(videoMimeType("file:///document/clip.MOV")).toBe("video/quicktime");
    expect(videoMimeType("content://media/external/video/42")).toBe("video/*");
  });
});

describe("playsInApp", () => {
  it("plays YouTube and Vimeo videos, direct links to a video file, and streams", () => {
    expect(playsInApp("https://youtu.be/abc123")).toBe(true);
    expect(playsInApp("https://vimeo.com/76979871/8272103f6e")).toBe(true);
    expect(playsInApp("https://cdn.example.com/whip/playlist.m3u8")).toBe(true);
    expect(playsInApp("https://cdn.example.com/whip/manifest.mpd")).toBe(true);
    // Played as raw=1, which serves the file.
    expect(
      playsInApp("https://www.dropbox.com/scl/fi/x/whip.mp4?rlkey=k&dl=0"),
    ).toBe(true);
    expect(playsInApp("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(playsInApp("https://example.com/clips/whip.MP4?dl=1")).toBe(true);
  });

  it("does not play a page that shows a video", () => {
    expect(
      playsInApp("https://drive.google.com/file/d/abc/view?usp=sharing"),
    ).toBe(false);
    expect(playsInApp("https://www.dropbox.com/s/abc/whip")).toBe(false);
    expect(playsInApp("not a link")).toBe(false);
  });
});

describe("awaitingLink", () => {
  afterEach(() => awaitingLink.clear());

  it("holds the latest video sent out, until its link is used", () => {
    awaitingLink.set({ listId: "l", sourceUri: "a.mp4", patternName: "Whip" });
    awaitingLink.set({ listId: "l", sourceUri: "b.mp4", patternName: "Tuck" });
    expect(awaitingLink.get()?.sourceUri).toBe("b.mp4");

    awaitingLink.clear("a.mp4");
    expect(awaitingLink.get()?.sourceUri).toBe("b.mp4");
    awaitingLink.clear("b.mp4");
    expect(awaitingLink.get()).toBeNull();
  });
});
