/**
 * Extracts a YouTube video ID from common URL formats:
 *  - https://www.youtube.com/watch?v=ID
 *  - https://youtu.be/ID
 *  - https://youtube.com/shorts/ID
 *  - https://m.youtube.com/watch?v=ID
 *  - (with or without extra query params / timestamps)
 *
 * Returns null if the URL is not a recognised YouTube URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      // https://youtu.be/VIDEO_ID
      return parsed.pathname.slice(1).split("/")[0] || null;
    }

    if (host === "youtube.com") {
      // /shorts/VIDEO_ID
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch) return shortsMatch[1];

      // /watch?v=VIDEO_ID
      return parsed.searchParams.get("v");
    }

    return null;
  } catch {
    return null;
  }
}

/** True when the URL points to a YouTube video. */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Returns a YouTube thumbnail URL for a given video ID.
 * Falls back gracefully: hqdefault is available for every public video.
 */
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Generates display thumbnails for an array of IVideoReference entries.
 * - URL references: returns a YouTube thumbnail URL when possible, otherwise "".
 * - Local references: attempts to extract a video frame via expo-video-thumbnails.
 * Returns a string[] of the same length as `videoRefs`.
 */
export async function generateVideoThumbnails(
  videoRefs: { type: "url" | "local"; value: string }[],
): Promise<string[]> {
  // Lazily import expo-video-thumbnails so it is only loaded when needed
  // and the util stays test-friendly (tests don't have a native module for it).
  const VideoThumbnails = await import("expo-video-thumbnails");
  const results: string[] = [];
  for (const ref of videoRefs) {
    if (ref.type === "url") {
      if (isYouTubeUrl(ref.value)) {
        const id = extractYouTubeVideoId(ref.value);
        results.push(id ? getYouTubeThumbnailUrl(id) : "");
      } else {
        results.push("");
      }
      continue;
    }
    let pending = localThumbnails.get(ref.value);
    if (!pending) {
      pending = VideoThumbnails.getThumbnailAsync(ref.value, {
        time: 1000,
        quality: 0.7,
      }).then(({ uri }) => uri);
      rememberThumbnail(ref.value, pending);
    }
    try {
      results.push(await pending);
    } catch {
      localThumbnails.delete(ref.value);
      results.push("");
    }
  }
  return results;
}

/**
 * Frames already taken, by video URI. Taking one decodes the video, and forms ask again on
 * every change to their videos: while a job ran, that was every progress tick, which made
 * the thumbnails flicker (each attempt is a new file) and took the decoder from the job.
 * A video at a URI does not change; an edit makes a new file.
 */
const localThumbnails = new Map<string, Promise<string>>();
const MAX_REMEMBERED_THUMBNAILS = 64;

function rememberThumbnail(uri: string, thumbnail: Promise<string>) {
  if (localThumbnails.size >= MAX_REMEMBERED_THUMBNAILS) {
    const oldest = localThumbnails.keys().next().value;
    if (oldest !== undefined) localThumbnails.delete(oldest);
  }
  localThumbnails.set(uri, thumbnail);
}
