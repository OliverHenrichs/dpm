import { withoutTranscripts } from "@/src/pattern/data/transcripts";
import {
  IModifier,
  IPattern,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";

/**
 * Only URL videos reach a published list. A local video is a file on the
 * publisher's phone: subscribers cannot play it, and its path is not something
 * the privacy policy lets leave the device.
 */
function onlineVideos(refs: IVideoReference[] | undefined): IVideoReference[] {
  return (refs ?? []).filter((ref) => ref.type === "url");
}

/** A pattern as it is published: no local videos, no transcripts (L4). */
export function publishedPattern(pattern: IPattern): IPattern {
  return withoutTranscripts({
    ...pattern,
    videoRefs: onlineVideos(pattern.videoRefs),
    modifierRefs: (pattern.modifierRefs ?? []).map((m) => ({
      ...m,
      videoRefs: onlineVideos(m.videoRefs),
    })),
  });
}

/** The list's modifiers as they are published: a universal one keeps only its URL videos. */
export function publishedModifiers(modifiers: IModifier[]): IModifier[] {
  return modifiers.map((m) => ({
    ...m,
    videoRefs: onlineVideos(m.videoRefs).map(
      ({ transcript: _t, ...ref }) => ref,
    ),
  }));
}
