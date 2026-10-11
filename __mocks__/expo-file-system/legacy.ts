/**
 * `expo-file-system/legacy`, only its download: the new API has no progress callback, so the
 * transcription models are fetched through this one (L4). Downloads write real bytes into the
 * in-memory filesystem of `__mocks__/expo-file-system.ts`, so what a test "downloads" can be
 * checked, moved and hashed like a real file. What a download returns is set with
 * `setDownloadResponse` there, and reset with the filesystem.
 *
 * Resuming works as on Android: `resumeData` is the number of bytes already in the file, the
 * rest is asked for and appended (206), unless the response ignores the range and sends the
 * whole body again (200, still appended, as Android's append mode does). A response with
 * `cutAt` writes up to that byte and then fails, as a dropped connection does.
 */
import {
  downloadResponse,
  readFileBytes,
  seedBinaryFile,
} from "../expo-file-system";

export function createDownloadResumable(
  url: string,
  fileUri: string,
  _options?: unknown,
  callback?: (p: {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
  }) => void,
  resumeData?: string,
) {
  return {
    async downloadAsync() {
      const { status, body, cutAt, ignoresRange } = downloadResponse(url);
      const from = resumeData ? Number(resumeData) : 0;
      const ranged = from > 0 && !ignoresRange && status === 200;
      if (status === 200) {
        const sent = ranged ? body.subarray(from) : body;
        const kept =
          from > 0 ? (readFileBytes(fileUri) ?? Buffer.alloc(0)) : null;
        const written = cutAt === undefined ? sent : sent.subarray(0, cutAt);
        seedBinaryFile(
          fileUri,
          kept ? Buffer.concat([kept, written]) : written,
        );
        callback?.({
          totalBytesWritten: (kept?.length ?? 0) + written.length,
          totalBytesExpectedToWrite: (kept?.length ?? 0) + sent.length,
        });
        if (cutAt !== undefined) {
          throw new Error("Software caused connection abort");
        }
      }
      return {
        uri: fileUri,
        status: ranged ? 206 : status,
        headers: {},
        mimeType: null,
      };
    },
  };
}
