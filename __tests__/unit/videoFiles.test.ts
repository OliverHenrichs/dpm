import {
  readFileBytes,
  resetFileSystemMock,
  seedBinaryFile,
} from "@/__mocks__/expo-file-system";
import { persistVideo } from "@/src/pattern/data/videoFiles";

const PICKER_CACHE = "file:///cache/ImagePicker/abc.mov";
const bytes = Buffer.from([0x00, 0xff, 0x10, 0x80]);

beforeEach(() => resetFileSystemMock());

describe("persistVideo", () => {
  it("copies a cache video into the document directory, bytes intact", async () => {
    seedBinaryFile(PICKER_CACHE, bytes);

    const uri = await persistVideo(PICKER_CACHE);

    expect(uri.startsWith("file:///document/")).toBe(true);
    expect(readFileBytes(uri)).toEqual(bytes);
  });

  it("keeps the file extension", async () => {
    seedBinaryFile(PICKER_CACHE, bytes);
    expect(await persistVideo(PICKER_CACHE)).toMatch(/\.mov$/);
  });

  it("names copies so they never overwrite each other", async () => {
    seedBinaryFile(PICKER_CACHE, bytes);
    const a = await persistVideo(PICKER_CACHE);
    const b = await persistVideo(PICKER_CACHE);
    expect(a).not.toBe(b);
  });

  it("leaves a video that already lives in the document directory alone", async () => {
    const kept = "file:///document/video-1.mp4";
    seedBinaryFile(kept, bytes);
    expect(await persistVideo(kept)).toBe(kept);
  });

  it("fails loudly when the source is gone", async () => {
    await expect(persistVideo(PICKER_CACHE)).rejects.toThrow(/ENOENT/);
  });
});
