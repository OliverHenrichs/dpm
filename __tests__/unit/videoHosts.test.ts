import {
  getVimeoThumbnailUrl,
  isVimeoUrl,
  parseVimeoUrl,
  vimeoPlayerUrl,
} from "@/src/common/utils/VimeoUtils";
import { embeddedHost, playableLink } from "@/src/common/utils/videoHosts";

describe("parseVimeoUrl", () => {
  it.each([
    ["https://vimeo.com/76979871", { id: "76979871" }],
    ["https://www.vimeo.com/76979871?share=copy", { id: "76979871" }],
    // An unlisted video's share link carries its privacy hash after the id.
    [
      "https://vimeo.com/76979871/8272103f6e",
      { id: "76979871", hash: "8272103f6e" },
    ],
    [
      "https://player.vimeo.com/video/76979871?h=8272103f6e&badge=0",
      { id: "76979871", hash: "8272103f6e" },
    ],
    ["https://vimeo.com/channels/staffpicks/76979871", { id: "76979871" }],
    ["https://vimeo.com/groups/wcs/videos/76979871", { id: "76979871" }],
  ])("reads %s", (url, video) => expect(parseVimeoUrl(url)).toEqual(video));

  it.each([
    "https://vimeo.com/showcase/123",
    "https://vimeo.com/someteacher",
    "https://player.vimeo.com/api/player.js",
    "https://notvimeo.com/76979871",
    "not a link",
  ])("refuses %j", (url) => expect(isVimeoUrl(url)).toBe(false));
});

describe("vimeoPlayerUrl", () => {
  it("keeps the hash an unlisted video needs and starts where asked", () => {
    expect(vimeoPlayerUrl({ id: "1", hash: "ab12" }, 75.4)).toBe(
      "https://player.vimeo.com/video/1?h=ab12&playsinline=1#t=75s",
    );
    expect(vimeoPlayerUrl({ id: "1" })).toBe(
      "https://player.vimeo.com/video/1?playsinline=1",
    );
  });
});

describe("embeddedHost", () => {
  it("names the host whose player plays a link", () => {
    expect(embeddedHost("https://youtu.be/abc123")).toBe("youtube");
    expect(embeddedHost("https://vimeo.com/76979871/8272103f6e")).toBe("vimeo");
    expect(embeddedHost("https://example.com/whip.mp4")).toBeNull();
  });
});

describe("playableLink", () => {
  it("asks Dropbox for the file, not the page that shows it", () => {
    expect(
      playableLink(
        " https://www.dropbox.com/scl/fi/xyz/whip.mp4?rlkey=k1&dl=0 ",
      ),
    ).toBe("https://www.dropbox.com/scl/fi/xyz/whip.mp4?rlkey=k1&raw=1");
    expect(playableLink("https://dropbox.com/s/abc/whip.mp4?raw=1")).toBe(
      "https://dropbox.com/s/abc/whip.mp4?raw=1",
    );
  });

  it("leaves every other link as it is", () => {
    expect(playableLink("https://youtu.be/abc?si=x")).toBe(
      "https://youtu.be/abc?si=x",
    );
    expect(playableLink("not a link ")).toBe("not a link");
  });
});

describe("getVimeoThumbnailUrl", () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  afterAll(() => {
    global.fetch = realFetch;
  });
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("asks Vimeo once per link for its preview image", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ thumbnail_url: "https://i.vimeocdn.com/1.jpg" }),
    });
    const url = "https://vimeo.com/111/aa";
    expect(await getVimeoThumbnailUrl(url)).toBe(
      "https://i.vimeocdn.com/1.jpg",
    );
    expect(await getVimeoThumbnailUrl(url)).toBe(
      "https://i.vimeocdn.com/1.jpg",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F111%2Faa",
    );
  });

  it("has none for a video Vimeo will not describe", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await getVimeoThumbnailUrl("https://vimeo.com/222")).toBe("");
  });

  it("asks again after a failure, which may have been the network", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    expect(await getVimeoThumbnailUrl("https://vimeo.com/333")).toBe("");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ thumbnail_url: "https://i.vimeocdn.com/3.jpg" }),
    });
    expect(await getVimeoThumbnailUrl("https://vimeo.com/333")).toBe(
      "https://i.vimeocdn.com/3.jpg",
    );
  });
});
