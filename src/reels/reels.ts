import {
  IPattern,
  IPatternList,
  IVideoReference,
} from "@/src/pattern/types/IPatternList";

/**
 * The reels: every pattern that has a video, one page each, with all of its videos — its own
 * first, then the ones of it danced with a modifier. A way to browse for inspiration before a
 * social rather than to look something up, so it only shows what has footage.
 */

export interface ReelVideo {
  key: string;
  video: IVideoReference;
  /** The modifier this video shows the pattern danced with, if any. */
  modifierName?: string;
}

export interface Reel {
  key: string;
  listId: string;
  listName: string;
  pattern: IPattern;
  typeName?: string;
  typeColor?: string;
  videos: ReelVideo[];
}

export interface ListWithPatterns {
  list: IPatternList;
  patterns: IPattern[];
}

function videosOf(pattern: IPattern, list: IPatternList): ReelVideo[] {
  const modifiers = new Map(list.modifiers.map((m) => [m.id, m]));
  const own = pattern.videoRefs.map((video, i) => ({
    key: `own:${i}`,
    video,
  }));
  const withModifiers = pattern.modifierRefs.flatMap((ref) => {
    const modifier = modifiers.get(ref.modifierId);
    // A modifier the list no longer has: its videos still show the pattern.
    return ref.videoRefs.map((video, i) => ({
      key: `${ref.modifierId}:${i}`,
      video,
      modifierName: modifier?.name,
    }));
  });
  return [...own, ...withModifiers];
}

/** The reels of some lists, in the lists' order and by name within each. */
export function collectReels(sources: ListWithPatterns[]): Reel[] {
  return sources.flatMap(({ list, patterns }) => {
    const types = new Map(list.patternTypes.map((t) => [t.id, t]));
    return [...patterns]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((pattern): Reel => {
        const type = types.get(pattern.typeId);
        return {
          key: `${list.id}:${pattern.id}`,
          listId: list.id,
          listName: list.name,
          pattern,
          typeName: type?.slug,
          typeColor: type?.color,
          videos: videosOf(pattern, list),
        };
      })
      .filter((reel) => reel.videos.length > 0);
  });
}
