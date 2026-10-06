import { Platform } from "react-native";
import * as Device from "expo-device";
import { seedBinaryFile } from "@/__mocks__/expo-file-system";
import { llamaCalls, setLlamaAnswer } from "@/__mocks__/llama.rn";
import { jobStore } from "@/src/anonymize/jobs/jobStore";
import {
  canSuggest,
  runSuggestion,
  SuggestionModelMissingError,
  SuggestionUnreadableError,
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

describe("runSuggestion", () => {
  it("asks for the model before anything else", async () => {
    await expect(runSuggestion(INPUT)).rejects.toBeInstanceOf(
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

    const suggestion = await runSuggestion(INPUT);

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

    expect(await runSuggestion(INPUT)).toEqual({ name: "", description: "" });
  });

  it("reports an answer it cannot read, and still frees the model", async () => {
    installModel();
    setLlamaAnswer(() => "Sorry, I can't.");

    await expect(runSuggestion(INPUT)).rejects.toBeInstanceOf(
      SuggestionUnreadableError,
    );
    expect(llamaCalls.releases).toBe(1);
  });

  it("frees the model when the completion fails", async () => {
    installModel();
    setLlamaAnswer(() => new Error("out of memory"));

    await expect(runSuggestion(INPUT)).rejects.toThrow("out of memory");
    expect(llamaCalls.releases).toBe(1);
  });

  it("runs as a job, after the video work queued before it, then waits for review", async () => {
    installModel();
    setLlamaAnswer(
      () =>
        '{"teaches":true,"name":"Sugar Push","description":"In on 1-2, out on 5-6."}',
    );
    let finishJob: () => void = () => undefined;
    const before = jobStore.runExclusive(
      () => new Promise<void>((resolve) => (finishJob = resolve)),
    );

    jobStore.start({
      kind: "suggest",
      listId: "list",
      patternName: "Push",
      request: { sourceUri: "file:///v.mp4", input: INPUT },
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(jobStore.getJobs()[0].status).toBe("queued");
    expect(llamaCalls.inits).toEqual([]);
    finishJob();
    await before;
    await new Promise((r) => setTimeout(r, 10));
    const [job] = jobStore.getJobs();
    expect(job.status).toBe("review");
    expect(job.suggestion).toEqual({
      name: "Sugar Push",
      description: "In on 1-2, out on 5-6.",
    });
    expect(llamaCalls.inits).toHaveLength(1);
  });

  it("reports a missing model as a failed job with its reason", async () => {
    // No model, and its download fails: the mock serves an empty file.
    jobStore.start({
      kind: "suggest",
      listId: "list",
      patternName: "Push",
      request: { sourceUri: "file:///v.mp4", input: INPUT },
    });
    await new Promise((r) => setTimeout(r, 10));
    const [job] = jobStore.getJobs();
    expect(job.status).toBe("failed");
    expect(job.errorKey).toBe("suggestErrorDownload");
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
