import { Directory, File, Paths } from "expo-file-system";

/**
 * The Whisper model, downloaded on first use rather than bundled (AGENT_TASKS.md, L4): most users
 * may never transcribe, and L3 already adds ~130 MB of weights to the app.
 */
export const WHISPER_MODEL = {
  id: "whisper-base-q5_1",
  fileName: "ggml-base-q5_1.bin",
  url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin",
  bytes: 59_707_625,
  /** SHA-256 as published by Hugging Face (the LFS object's etag). Not checked yet — see L4. */
  sha256: "422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898",
} as const;

const modelDir = () => new Directory(Paths.document, "models");
const modelFile = () => new File(modelDir(), WHISPER_MODEL.fileName);

/** The model's file, when it is on the device and complete. */
export function installedModel(): File | null {
  const file = modelFile();
  return file.exists && file.size === WHISPER_MODEL.bytes ? file : null;
}

/**
 * Downloads the model unless it is already here. A partial file from an interrupted download has
 * the wrong size, so it is replaced rather than trusted.
 */
export async function ensureModel(): Promise<File> {
  const ready = installedModel();
  if (ready) return ready;

  const dir = modelDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const partial = new File(dir, `${WHISPER_MODEL.fileName}.part`);
  if (partial.exists) partial.delete();

  const downloaded = await File.downloadFileAsync(WHISPER_MODEL.url, partial);
  if (downloaded.size !== WHISPER_MODEL.bytes) {
    downloaded.delete();
    throw new Error(
      `Model download incomplete: ${downloaded.size} of ${WHISPER_MODEL.bytes} bytes`,
    );
  }
  const target = modelFile();
  if (target.exists) target.delete();
  downloaded.move(target);
  return target;
}

/** Frees the space; the next transcription downloads it again. */
export function deleteModel(): void {
  const file = modelFile();
  if (file.exists) file.delete();
}
