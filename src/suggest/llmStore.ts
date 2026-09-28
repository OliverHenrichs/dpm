import { Directory, File, Paths } from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import { LlmSpec } from "@/src/suggest/llmModels";

// SPIKE (L4 suggestions): the Whisper store's shape, minus the hash — sizes are checked.

const dir = () => new Directory(Paths.document, "llm");
const fileFor = (model: LlmSpec) => new File(dir(), model.fileName);

export function llmUri(model: LlmSpec): string | null {
  const file = fileFor(model);
  return file.exists && file.size === model.bytes ? file.uri : null;
}

export async function downloadLlm(
  model: LlmSpec,
  onProgress: (fraction: number) => void,
): Promise<string> {
  const ready = llmUri(model);
  if (ready) return ready;
  if (!dir().exists) dir().create({ intermediates: true });
  const partial = new File(dir(), `${model.fileName}.part`);
  if (partial.exists) partial.delete();
  const result = await createDownloadResumable(
    model.url,
    partial.uri,
    {},
    (p) => onProgress(p.totalBytesWritten / model.bytes),
  ).downloadAsync();
  const written = new File(partial.uri);
  const size = written.exists ? written.size : 0;
  if (!result || result.status !== 200 || size !== model.bytes) {
    if (written.exists) written.delete();
    throw new Error(
      `Download of ${model.id} failed: HTTP ${result?.status}, ${size} of ${model.bytes} bytes`,
    );
  }
  written.move(fileFor(model));
  return fileFor(model).uri;
}

export function deleteLlm(model: LlmSpec) {
  const file = fileFor(model);
  if (file.exists) file.delete();
}
