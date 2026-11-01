import {
  IModifier,
  IPattern,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";
import { PatternListWithPatterns } from "@/src/pattern/data/types/IExportData";
import { normalizeList } from "@/src/pattern/data/validation/validateExportData";
import { ImportMessage } from "@/src/pattern/data/validation/importMessages";

/**
 * A shared list as another phone published it, made safe to store and show.
 *
 * The rules check only the outline of `sharedLists/{code}` (a `list` map with a string id and
 * name, a `patterns` list), and the app token that lets a phone write it ships inside the app, so
 * anyone can publish anything that outline allows. The list goes through the same repairs as an
 * import file (`normalizeList`), and on top of that:
 *
 * - only web videos stay (`http(s)` links of `type: "url"`): the publish path strips local videos,
 *   so one in a downloaded list was put there by hand;
 * - nothing that is this phone's own business comes from the cloud: `readonly`, the share key,
 *   and the share code, which is the one the list was read under.
 *
 * Returns null when the list is unusable (not an object, no id, a figure without a numeric id):
 * the subscriber then keeps what it has.
 */
export function validateSharedList(
  rawList: unknown,
  rawPatterns: unknown,
  shareCode: string,
): PatternListWithPatterns | null {
  if (typeof rawList !== "object" || rawList === null || Array.isArray(rawList))
    return null;
  const errors: ImportMessage[] = [];
  const warnings: ImportMessage[] = [];
  const list = normalizeList(
    { ...(rawList as Record<string, unknown>), patterns: rawPatterns },
    0,
    errors,
    warnings,
  );
  if (!list || errors.length > 0) return null;
  const {
    readonly: _readonly,
    shareKey: _shareKey,
    shareCode: _shareCode,
    ...rest
  } = list;
  return {
    ...rest,
    shareCode,
    modifiers: rest.modifiers.map(webVideosOfModifier),
    patterns: rest.patterns.map(webVideosOfPattern),
  };
}

/** A link a subscriber's player may open: a web address, nothing on the phone. */
export function isWebVideo(ref: IVideoReference): boolean {
  return ref.type === "url" && /^https?:\/\/\S+$/i.test(ref.value.trim());
}

const webVideos = (refs: IVideoReference[] | undefined): IVideoReference[] =>
  (refs ?? []).filter(isWebVideo);

function webVideosOfModifier(modifier: IModifier): IModifier {
  return { ...modifier, videoRefs: webVideos(modifier.videoRefs) };
}

function webVideosOfPattern(pattern: IPattern): IPattern {
  return {
    ...pattern,
    videoRefs: webVideos(pattern.videoRefs),
    modifierRefs: (pattern.modifierRefs ?? []).map((ref) => ({
      ...ref,
      videoRefs: webVideos(ref.videoRefs),
    })),
  };
}
