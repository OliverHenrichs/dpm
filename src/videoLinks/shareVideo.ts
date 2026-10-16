import * as Sharing from "expo-sharing";
import { videoMimeType } from "@/src/videoLinks/videoLinks";

/** Whether this device can hand a file to another app (not on web). */
export async function canShareVideos(): Promise<boolean> {
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Opens the system share sheet on a local video, so the user can upload it with the app of their
 * choice (YouTube, Drive, …). DPM itself sends nothing anywhere.
 */
export async function shareVideoFile(
  uri: string,
  dialogTitle: string,
): Promise<void> {
  await Sharing.shareAsync(uri, { mimeType: videoMimeType(uri), dialogTitle });
}
