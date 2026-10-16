/** A Vimeo video: its id, and the privacy hash an unlisted video's link carries. */
export type VimeoVideo = { id: string; hash?: string };

/**
 * Reads a Vimeo video from the link formats people copy:
 *  - https://vimeo.com/ID
 *  - https://vimeo.com/ID/HASH (an unlisted video's share link)
 *  - https://vimeo.com/channels/NAME/ID, https://vimeo.com/groups/NAME/videos/ID
 *  - https://player.vimeo.com/video/ID?h=HASH (an embed link)
 *
 * Returns null if the URL is not a recognised Vimeo video. Showcases, profiles and other pages
 * are not videos.
 */
export function parseVimeoUrl(url: string): VimeoVideo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (host === "player.vimeo.com") {
    if (parts[0] !== "video" || !/^\d+$/.test(parts[1] ?? "")) return null;
    return withHash(parts[1], parsed.searchParams.get("h"));
  }
  if (host !== "vimeo.com") return null;

  if (parts[0] === "channels" && /^\d+$/.test(parts[2] ?? "")) {
    return withHash(parts[2], parsed.searchParams.get("h"));
  }
  if (
    parts[0] === "groups" &&
    parts[2] === "videos" &&
    /^\d+$/.test(parts[3] ?? "")
  ) {
    return withHash(parts[3], parsed.searchParams.get("h"));
  }
  if (/^\d+$/.test(parts[0] ?? "")) {
    const hash = /^[0-9a-f]+$/i.test(parts[1] ?? "") ? parts[1] : null;
    return withHash(parts[0], hash ?? parsed.searchParams.get("h"));
  }
  return null;
}

function withHash(id: string, hash: string | null | undefined): VimeoVideo {
  return hash ? { id, hash } : { id };
}

/** True when the URL points to a Vimeo video. */
export function isVimeoUrl(url: string): boolean {
  return parseVimeoUrl(url) !== null;
}

/**
 * The address of Vimeo's own player for [video]. An unlisted video plays only with its hash;
 * a password-protected one asks for the password in the player.
 */
export function vimeoPlayerUrl(video: VimeoVideo, startTime?: number): string {
  const query = new URLSearchParams();
  if (video.hash) query.set("h", video.hash);
  query.set("playsinline", "1");
  const start = startTime ? `#t=${Math.floor(startTime)}s` : "";
  return `https://player.vimeo.com/video/${video.id}?${query.toString()}${start}`;
}

/**
 * A preview image for a Vimeo link, from Vimeo's oEmbed endpoint, or "" when there is none (a
 * private video, no network). Vimeo has no fixed thumbnail address as YouTube does, so this asks
 * once per link and remembers the answer.
 */
export function getVimeoThumbnailUrl(url: string): Promise<string> {
  let pending = vimeoThumbnails.get(url);
  if (!pending) {
    pending = fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { thumbnail_url?: unknown } | null) =>
        typeof body?.thumbnail_url === "string" ? body.thumbnail_url : "",
      )
      .catch(() => {
        // A failure is not remembered: the next look may be online.
        vimeoThumbnails.delete(url);
        return "";
      });
    vimeoThumbnails.set(url, pending);
  }
  return pending;
}

const vimeoThumbnails = new Map<string, Promise<string>>();
