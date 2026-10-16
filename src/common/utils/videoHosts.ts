import { isYouTubeUrl } from "@/src/common/utils/YouTubeUtils";
import { isVimeoUrl } from "@/src/common/utils/VimeoUtils";

/** A host whose own player DPM embeds (in a WebView, or an iframe on web). */
export type EmbeddedHost = "youtube" | "vimeo";

/**
 * The host whose player plays [url], or null for a link `expo-video` plays itself (a video
 * file or a stream) or cannot play at all (a page).
 */
export function embeddedHost(url: string): EmbeddedHost | null {
  if (isYouTubeUrl(url)) return "youtube";
  if (isVimeoUrl(url)) return "vimeo";
  return null;
}

/**
 * The link as a player needs it. A Dropbox share link opens a page that shows the video; with
 * `raw=1` in place of `dl=0` it serves the file itself. Every other link is returned as it is.
 */
export function playableLink(url: string): string {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "dropbox.com") return trimmed;
  if (parsed.searchParams.get("raw") === "1") return trimmed;
  parsed.searchParams.delete("dl");
  parsed.searchParams.set("raw", "1");
  return parsed.toString();
}
