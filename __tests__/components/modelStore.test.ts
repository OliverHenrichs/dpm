import {
  listFileUris,
  seedBinaryFile,
  setDownloadResponse,
} from "@/__mocks__/expo-file-system";
import { AudioExtractModule } from "@/modules/audio-extract";
import {
  deleteModels,
  ensureModels,
  installedModels,
  ModelDownloadError,
} from "@/src/transcribe/modelStore";

jest.mock("@/modules/audio-extract", () => ({
  AudioExtractModule: { sha256File: jest.fn() },
}));

// Two tiny stand-ins for the 60 MB and 0.9 MB models.
jest.mock("@/src/transcribe/models", () => {
  const WHISPER_MODEL = {
    id: "whisper",
    fileName: "whisper.bin",
    url: "https://models/whisper.bin",
    bytes: 6,
    sha256: "hash-whisper",
  };
  const VAD_MODEL = {
    id: "vad",
    fileName: "vad.bin",
    url: "https://models/vad.bin",
    bytes: 2,
    sha256: "hash-vad",
  };
  return {
    WHISPER_MODEL,
    VAD_MODEL,
    TRANSCRIPTION_MODELS: [WHISPER_MODEL, VAD_MODEL],
    TRANSCRIPTION_DOWNLOAD_BYTES: 8,
  };
});

const sha = AudioExtractModule!.sha256File as jest.Mock;
const MODELS = "file:///document/models/";

/** Serves each model with the right bytes, and hashes them to their published values. */
function serveModels({
  vadStatus = 200,
  vadBytes = 2,
  vadHash = "hash-vad",
} = {}) {
  setDownloadResponse((url) =>
    url.endsWith("whisper.bin")
      ? { status: 200, body: Buffer.alloc(6) }
      : { status: vadStatus, body: Buffer.alloc(vadBytes) },
  );
  sha.mockImplementation(async (uri: string) =>
    uri.includes("whisper") ? "hash-whisper" : vadHash,
  );
}

describe("the transcription model store", () => {
  it("starts with nothing installed", () => {
    expect(installedModels()).toBeNull();
  });

  it("downloads both models, reporting progress over the whole download", async () => {
    serveModels();
    const seen: number[] = [];

    const installed = await ensureModels((f) => seen.push(f));

    expect(installed).toEqual({
      whisperUri: `${MODELS}whisper.bin`,
      vadUri: `${MODELS}vad.bin`,
    });
    expect(installedModels()).toEqual(installed);
    expect(seen).toEqual([6 / 8, 1, 1]);
    // No half-finished files left behind.
    expect(listFileUris().filter((u) => u.endsWith(".part"))).toEqual([]);
  });

  it("does not download what is already there", async () => {
    seedBinaryFile(`${MODELS}whisper.bin`, Buffer.alloc(6));
    serveModels();
    const fetched: string[] = [];
    setDownloadResponse((url) => {
      fetched.push(url);
      return { status: 200, body: Buffer.alloc(2) };
    });

    await ensureModels();

    expect(fetched).toEqual(["https://models/vad.bin"]);
  });

  it("rejects a corrupt download and installs nothing in its place", async () => {
    serveModels({ vadHash: "something-else" });

    await expect(ensureModels()).rejects.toBeInstanceOf(ModelDownloadError);
    expect(installedModels()).toBeNull();
    expect(listFileUris()).not.toContain(`${MODELS}vad.bin`);
  });

  it("rejects an incomplete download", async () => {
    serveModels({ vadBytes: 1 });

    await expect(ensureModels()).rejects.toThrow("incomplete");
    expect(installedModels()).toBeNull();
  });

  it("reports a failed download", async () => {
    serveModels({ vadStatus: 404 });

    await expect(ensureModels()).rejects.toThrow("HTTP 404");
  });

  it("takes a model of the wrong size for missing", () => {
    seedBinaryFile(`${MODELS}whisper.bin`, Buffer.alloc(5));
    seedBinaryFile(`${MODELS}vad.bin`, Buffer.alloc(2));

    expect(installedModels()).toBeNull();
  });

  it("frees the space again", async () => {
    serveModels();
    await ensureModels();

    deleteModels();

    expect(installedModels()).toBeNull();
    expect(listFileUris()).toEqual([]);
  });
});
