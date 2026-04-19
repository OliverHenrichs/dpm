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
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(ref.value, {
        time: 1000,
        quality: 0.7,
      });
      results.push(uri);
    } catch {
      results.push("");
    }
  }
  return results;
}
