import { findWebUrl } from "@/src/videoLinks/videoLinks";
import { playableLink } from "@/src/common/utils/videoHosts";

/** What another app shared to DPM, as far as DPM can use it. */
export type SharedContent =
  | { kind: "link"; url: string }
  | { kind: "video"; uri: string }
  | { kind: "unusable" };

/** The parts of `expo-share-intent`'s `ShareIntent` read here. */
export type IncomingShare = {
  text?: string | null;
  webUrl?: string | null;
  files?: { path: string; mimeType: string }[] | null;
};

/**
 * A video file wins over text: an app sharing a video may add a caption. Of several files the
 * first video is taken (DPM registers for one at a time). Text is used only when it holds a link;
 * the library's own `webUrl` is a loose match, so the link is looked for again.
 */
export function readSharedContent(share: IncomingShare): SharedContent {
  const video = share.files?.find(
    (file) => !!file.path && file.mimeType?.startsWith("video/"),
  );
  if (video) return { kind: "video", uri: video.path };
  const url = findWebUrl(share.webUrl) ?? findWebUrl(share.text);
  if (url) return { kind: "link", url: playableLink(url) };
  return { kind: "unusable" };
}
