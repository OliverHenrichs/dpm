import { Directory, File, Paths } from "expo-file-system";
// The legacy API is the one with a progress callback for downloads; 60 MB without a progress
// bar is not acceptable (L4 spike).
import { createDownloadResumable } from "expo-file-system/legacy";
import { AudioExtractModule } from "@/modules/audio-extract";
import {
  ModelSpec,
  TRANSCRIPTION_MODELS,
  VAD_MODEL,
  WHISPER_ACCURATE_MODEL,
  WHISPER_MODEL,
} from "@/src/transcribe/models";

/**
 * The app's downloaded models — the speech models here, and the suggestion model
 * (`src/suggest/`) through the per-model helpers below: one folder, one verified download path.
 */
const modelDir = () => new Directory(Paths.document, "models");
const fileFor = (model: ModelSpec) => new File(modelDir(), model.fileName);

/** The model's file when it is on the device and complete (size checked; hashed on download). */
export function installedModelUri(model: ModelSpec): string | null {
  const file = fileFor(model);
  return file.exists && file.size === model.bytes ? file.uri : null;
}

/** Removes one model's file; the next use downloads it again. */
export function deleteModel(model: ModelSpec): void {
  const file = fileFor(model);
  if (file.exists) file.delete();
}

export type InstalledModels = {
  whisperUri: string;
  vadUri: string;
  /** Which Whisper model, recorded on the transcript. */
  whisperModelId: string;
};

/** The Whisper model transcription uses: the accurate one once it is on the phone, else base. */
function whisperModel(): ModelSpec {
  return installedModelUri(WHISPER_ACCURATE_MODEL)
    ? WHISPER_ACCURATE_MODEL
    : WHISPER_MODEL;
}

/**
 * The models' files, when a Whisper model and the VAD are on the device and complete. Size is
 * the check here; the hash was checked once, when they were downloaded.
 */
export function installedModels(): InstalledModels | null {
  const whisper = whisperModel();
  const whisperUri = installedModelUri(whisper);
  const vadUri = installedModelUri(VAD_MODEL);
  return whisperUri && vadUri
    ? { whisperUri, vadUri, whisperModelId: whisper.id }
    : null;
}

export class ModelDownloadError extends Error {}

/**
 * Downloads whichever models are missing, reporting progress over the whole download as a
 * fraction. Each file goes to a `.part` name and is moved into place only once its size and
 * SHA-256 match, so an interrupted or corrupted download is never taken for a model.
 */
export async function ensureModels(
  onProgress?: (fraction: number) => void,
): Promise<InstalledModels> {
  const ready = installedModels();
  if (ready) return ready;
  // With the accurate model on the phone, base is not needed; only the VAD can be missing.
  await downloadMissing(
    installedModelUri(WHISPER_ACCURATE_MODEL)
      ? [VAD_MODEL]
      : TRANSCRIPTION_MODELS,
    onProgress,
  );
  return installedModels()!;
}

/**
 * Downloads whichever of the models are not on the device, reporting progress over all of
 * them as a fraction.
 */
export async function downloadMissing(
  models: ModelSpec[],
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const total = models.reduce((sum, m) => sum + m.bytes, 0);
  let doneBytes = 0;
  for (const model of models) {
    if (!installedModelUri(model)) {
      await downloadModel(model, (written) =>
        onProgress?.((doneBytes + written) / total),
      );
    }
    doneBytes += model.bytes;
  }
  onProgress?.(1);
}

/**
 * Downloads one model to a `.part` file and moves it into place once its size and SHA-256
 * match, so an interrupted or corrupted download is never taken for a model. Reports bytes
 * written so far.
 */
export async function downloadModel(
  model: ModelSpec,
  onBytes: (written: number) => void,
): Promise<void> {
  const dir = modelDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const partial = new File(modelDir(), `${model.fileName}.part`);
  if (partial.exists) partial.delete();

  const task = createDownloadResumable(model.url, partial.uri, {}, (p) =>
    onBytes(p.totalBytesWritten),
  );
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) {
    if (partial.exists) partial.delete();
    throw new ModelDownloadError(
      `Download of ${model.id} failed (HTTP ${result?.status ?? "none"})`,
    );
  }

  const written = new File(result.uri);
  const size = written.size;
  if (size !== model.bytes) {
    written.delete();
    throw new ModelDownloadError(
      `Download of ${model.id} incomplete: ${size} of ${model.bytes} bytes`,
    );
  }
  const hash = await AudioExtractModule?.sha256File(written.uri);
  if (hash !== model.sha256) {
    written.delete();
    throw new ModelDownloadError(`Download of ${model.id} is corrupt`);
  }

  const target = fileFor(model);
  if (target.exists) target.delete();
  written.move(target);
}

/**
 * Frees the standard models' space (~60 MB); the next transcription downloads them again. The
 * accurate model has its own row in Settings and is deleted there.
 */
export function deleteModels(): void {
  TRANSCRIPTION_MODELS.forEach(deleteModel);
}
