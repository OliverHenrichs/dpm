/**
 * `expo-file-system/legacy`, only its download: the new API has no progress callback, so the
 * transcription models are fetched through this one (L4). Downloads write real bytes into the
 * in-memory filesystem of `__mocks__/expo-file-system.ts`, so what a test "downloads" can be
 * checked, moved and hashed like a real file. What a download returns is set with
 * `setDownloadResponse` there, and reset with the filesystem.
 */
import { downloadResponse, seedBinaryFile } from "../expo-file-system";

export function createDownloadResumable(
  url: string,
  fileUri: string,
  _options?: unknown,
  callback?: (p: {
    totalBytesWritten: number;
    totalBytesExpectedToWrite: number;
  }) => void,
) {
  return {
    async downloadAsync() {
      const { status, body } = downloadResponse(url);
      if (status === 200) {
        seedBinaryFile(fileUri, body);
        callback?.({
          totalBytesWritten: body.length,
          totalBytesExpectedToWrite: body.length,
        });
      }
      return { uri: fileUri, status, headers: {}, mimeType: null };
    },
  };
}
