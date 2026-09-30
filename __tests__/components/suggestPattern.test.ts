import { Platform } from "react-native";
import * as Device from "expo-device";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import { llamaCalls, setLlamaAnswer } from "@/__mocks__/llama.rn";
import { jobStore } from "@/src/deidentify/jobs/jobStore";
import {
  canSuggest,
  suggestPattern,
  SuggestionModelMissingError,
  SuggestionUnreadableError,
  SuggestPhase,
} from "@/src/suggest/suggestPattern";

// A stand-in of a few bytes for the 1.3 GB model.
jest.mock("@/src/suggest/models", () => ({
  SUGGESTION_MODEL: {
    id: "llm",
    fileName: "llm.gguf",
    url: "https://models/llm.gguf",
    bytes: 4,
    sha256: "hash-llm",
  },
  SUGGESTION_DOWNLOAD_MB: 0,
  MIN_DEVICE_MEMORY_BYTES: 6 * 1024 ** 3,
}));
jest.mock("@/modules/audio-extract", () => ({
  isAudioExtractAvailable: true,
  AudioExtractModule: {},
}));
jest.mock("expo-device", () => ({ totalMemory: 8 * 1024 ** 3 }));

const MODEL_URI = "file:///document/models/llm.gguf";
const INPUT = {
  transcript: "This is the sugar bush: in on one two, out on five six.",
  language: "en",
  vocabulary: ["Sugar Push", "Whip"],
};

const installModel = () => seedBinaryFile(MODEL_URI, Buffer.alloc(4));

afterEach(() => jobStore.reset());

describe("suggestPattern", () => {
  it("asks for the model before anything else", async () => {
    await expect(suggestPattern(INPUT)).rejects.toBeInstanceOf(
      SuggestionModelMissingError,
    );
    expect(llamaCalls.inits).toEqual([]);
  });

  it("drafts a name and description from the transcript, then frees the model", async () => {
    installModel();
    setLlamaAnswer(
      () =>
        '{"teaches":true,"name":"Sugar Push","description":"In on 1-2, out on 5-6."}',
    );

    const suggestion = await suggestPattern(INPUT);

    expect(suggestion).toEqual({
      name: "Sugar Push",
      description: "In on 1-2, out on 5-6.",
    });
    expect(llamaCalls.inits).toEqual([{ model: MODEL_URI }]);
    const [call] = llamaCalls.completions;
    expect(call.enable_thinking).toBe(false);
    expect(call.response_format).toMatchObject({ type: "json_schema" });
    const user = call.messages!.at(-1)!.content;
    expect(user).toContain("Vocabulary: Sugar Push, Whip");
    expect(user).toContain("sugar bush");
    expect(user).toContain("in English");
    expect(llamaCalls.releases).toBe(1);
  });

  it("gives nothing when the model finds nothing taught", async () => {
    installModel();
    setLlamaAnswer(
      () => '{"teaches":false,"name":"Open whip","description":"x"}',
    );

    expect(await suggestPattern(INPUT)).toEqual({ name: "", description: "" });
  });

  it("reports an answer it cannot read, and still frees the model", async () => {
    installModel();
    setLlamaAnswer(() => "Sorry, I can't.");

    await expect(suggestPattern(INPUT)).rejects.toBeInstanceOf(
      SuggestionUnreadableError,
    );
    expect(llamaCalls.releases).toBe(1);
  });

  it("frees the model when the completion fails", async () => {
    installModel();
    setLlamaAnswer(() => new Error("out of memory"));

    await expect(suggestPattern(INPUT)).rejects.toThrow("out of memory");
    expect(llamaCalls.releases).toBe(1);
  });

  it("waits for the video work queued before it, never running beside it", async () => {
    installModel();
    let finishJob: () => void = () => undefined;
    const job = jobStore.runExclusive(
      () => new Promise<void>((resolve) => (finishJob = resolve)),
    );
    const phases: SuggestPhase[] = [];

    const suggestion = suggestPattern(INPUT, (p) => phases.push(p));
    await new Promise((r) => setTimeout(r, 10));

    expect(phases).toEqual(["waiting"]);
    expect(llamaCalls.inits).toEqual([]);
    finishJob();
    await job;
    await suggestion;
    expect(phases).toEqual(["waiting", "loading", "thinking"]);
  });
});

describe("canSuggest", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    (Device as { totalMemory: number | null }).totalMemory = 8 * 1024 ** 3;
  });

  it("is on for an Android phone with enough memory", () => {
    Platform.OS = "android";
    expect(canSuggest()).toBe(true);
  });

  it("is off below 6 GB, where Android would kill the app", () => {
    Platform.OS = "android";
    (Device as { totalMemory: number | null }).totalMemory = 4 * 1024 ** 3;
    expect(canSuggest()).toBe(false);
  });

  it("is off where the model's hash cannot be checked", () => {
    Platform.OS = "ios";
    expect(canSuggest()).toBe(false);
  });
});
