import { IVideoReference } from "@/src/pattern/types/IPatternList";
import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";

/** Whether [text] is one http(s) address, as a video link must be. */
export function isWebUrl(text: string): boolean {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
  try {
    return !!new URL(trimmed).hostname;
  } catch {
    return false;
  }
}

/**
 * The first http(s) address in [text], or null. Apps share a link with words around it
 * ("Watch this on YouTube: https://youtu.be/…"), so the address is looked for, not assumed.
 * Punctuation that closes a sentence is left out of it.
 */
export function findWebUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+/gi)) {
    const url = match[0].replace(/[.,;:!?)\]}'"]+$/, "");
    if (isWebUrl(url)) return url;
  }
  return null;
}

/**
 * The online copy of a local video: the link takes the file's place and keeps what the app
 * knows about the video, its transcript and how it was made. The file's start time does not
 * carry over: a local video has none, and a link's is the user's to set.
 */
export function linkedVideo(
  previous: IVideoReference,
  url: string,
): IVideoReference {
  return {
    type: "url",
    value: url.trim(),
    ...(previous.generated && { generated: previous.generated }),
    ...(previous.transcript && { transcript: previous.transcript }),
  };
}

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  mkv: "video/x-matroska",
};

/** The video's type by its extension; apps like YouTube only offer themselves for a video. */
export function videoMimeType(uri: string): string {
  const ext = /\.([a-z0-9]{2,4})$/i.exec(uri)?.[1]?.toLowerCase();
  return (ext && MIME_TYPES[ext]) || "video/*";
}

/**
 * Whether DPM can play [url] itself: a YouTube video, or a direct link to a video file. A page
 * that shows a video (Google Drive, Dropbox, Vimeo) is not a video file and does not play.
 */
export function playsInApp(url: string): boolean {
  if (isYouTubeUrl(url)) return true;
  try {
    const ext = /\.([a-z0-9]{2,4})$/i.exec(new URL(url).pathname)?.[1];
    return !!ext && ext.toLowerCase() in MIME_TYPES;
  } catch {
    return false;
  }
}
