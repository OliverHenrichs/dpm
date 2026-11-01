import { rhythmMatchesCounts } from "@/src/pattern/rhythm/rhythm";
import {
  IPattern,
  IPatternList,
  IPatternModifierRef,
  ISuggestionPolicy,
  IGeneratedVideo,
  IVideoReference,
  NewPattern,
} from "@/src/pattern/types/IPatternList";
import { resolveLevelIds } from "@/src/pattern/types/PatternLevel";

/** The most suggestions a publisher can allow a day; `firestore.rules` holds the same bound. */
export const MAX_SUGGESTIONS_PER_DAY = 100;

/** The daily limits the share sheet offers. */
export const DAILY_LIMIT_CHOICES = [1, 3, 5, 10, 20] as const;

/** What switching suggestions on starts with. */
export const DEFAULT_SUGGESTION_POLICY: ISuggestionPolicy = {
  dailyLimit: 3,
  per: "subscriber",
};

/** How long a name signing a suggestion can be; the rules hold the same bound. */
export const MAX_AUTHOR_NAME_LENGTH = 40;

// The rules' bounds on a suggested pattern (`isSuggestedPattern` in firestore.rules).
/** Exported so the suggest form stops typing there rather than cutting the name on send. */
export const MAX_SUGGESTED_NAME_LENGTH = 100;
const MAX_NAME = MAX_SUGGESTED_NAME_LENGTH;
/** A rhythm cannot be cut and still match its counts, so a longer one is left out. */
const MAX_RHYTHM = 200;
const MAX_DESCRIPTION = 2000;
const MAX_PREREQUISITES = 50;
const MAX_TAGS = 20;
const MAX_VIDEOS = 10;
const MAX_MODIFIER_REFS = 50;
const MAX_GENERATED_METHOD = 64;

const DAY_MS = 86_400_000;

/** Days since the epoch in UTC: the day a suggestion counts against. */
export function utcDay(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS);
}

/**
 * The counter a suggestion is counted in: the list's for today, or the subscriber's own. The
 * rules derive the same name from the server's clock.
 */
export function counterIdFor(
  policy: ISuggestionPolicy,
  uid: string,
  now: number = Date.now(),
): string {
  const day = `d${utcDay(now)}`;
  return policy.per === "subscriber" ? `${day}_${uid}` : day;
}

/** Whether this phone can suggest patterns for the list: a subscribed copy that takes them. */
export function canSuggestTo(list: IPatternList | null | undefined): boolean {
  return !!list?.readonly && !!list.shareCode && !!list.suggestions;
}

/** Whether this phone can suggest changes to the list's figures: its list owner allows them. */
export function canSuggestEditsTo(
  list: IPatternList | null | undefined,
): boolean {
  return canSuggestTo(list) && list?.suggestions?.edits === true;
}

/** Whether the list is this phone's own published list, where suggestions arrive. */
export function receivesSuggestions(
  list: IPatternList | null | undefined,
): boolean {
  return !!list && !list.readonly && !!list.shareCode;
}

function onlineVideos(refs: IVideoReference[] | undefined): IVideoReference[] {
  return (refs ?? [])
    .filter((ref) => ref.type === "url")
    .map(({ type, value, startTime, generated }) => ({
      type,
      value,
      ...(typeof startTime === "number" && { startTime }),
      // Where it came from (anonymized), so the list owner can see it; never the transcript.
      ...(generated && {
        generated: { method: generated.method, createdAt: generated.createdAt },
      }),
    }));
}

/**
 * A pattern as a subscriber sends it: what the form holds, without anything that stays on the
 * phone (local videos, transcripts, when it was made) or that Firestore refuses (`undefined`),
 * and within the rules' bounds.
 */
export function suggestedPattern(pattern: NewPattern): NewPattern {
  // Field by field, so nothing else the object carries (an id, `createdAt`) goes along.
  const { level, rhythm } = pattern;
  return {
    name: pattern.name.trim().slice(0, MAX_NAME),
    typeId: pattern.typeId,
    counts: pattern.counts,
    ...(level && { level }),
    ...(rhythm && rhythm.length <= MAX_RHYTHM && { rhythm }),
    prerequisites: (pattern.prerequisites ?? []).slice(0, MAX_PREREQUISITES),
    description: (pattern.description ?? "").slice(0, MAX_DESCRIPTION),
    tags: (pattern.tags ?? []).slice(0, MAX_TAGS),
    videoRefs: onlineVideos(pattern.videoRefs).slice(0, MAX_VIDEOS),
    modifierRefs: (pattern.modifierRefs ?? [])
      .slice(0, MAX_MODIFIER_REFS)
      .map(({ modifierId, videoRefs }) => ({
        modifierId,
        videoRefs: onlineVideos(videoRefs).slice(0, MAX_VIDEOS),
      })),
  };
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function asGenerated(raw: unknown): IGeneratedVideo | undefined {
  return isObject(raw) &&
    typeof raw.method === "string" &&
    raw.method.length <= MAX_GENERATED_METHOD &&
    typeof raw.createdAt === "number" &&
    Number.isFinite(raw.createdAt)
    ? { method: raw.method, createdAt: raw.createdAt }
    : undefined;
}

/** URL videos from another phone's suggestion; anything else is left out. */
export function asVideoRefs(raw: unknown): IVideoReference[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (v): v is Record<string, unknown> =>
        isObject(v) &&
        v.type === "url" &&
        typeof v.value === "string" &&
        /^https?:\/\//i.test(v.value),
    )
    .slice(0, MAX_VIDEOS)
    .map((v) => {
      const generated = asGenerated(v.generated);
      return {
        type: "url" as const,
        value: v.value as string,
        ...(typeof v.startTime === "number" &&
          Number.isFinite(v.startTime) &&
          v.startTime >= 0 && { startTime: v.startTime }),
        ...(generated && { generated }),
      };
    });
}

/**
 * The pattern a suggestion proposes, made safe to add to the publisher's list: another phone
 * wrote it, perhaps not this app, and the list may have changed since. Types, prerequisites
 * and modifiers that are not in the list any more are dropped (an unknown type becomes the
 * list's first), videos are URLs only, and a rhythm stays only if it matches the counts.
 * Returns null when there is no pattern to speak of (no name).
 */
export function patternFromSuggestion(
  raw: unknown,
  list: IPatternList,
  patterns: IPattern[],
): NewPattern | null {
  if (!isObject(raw)) return null;
  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return null;

  const typeIds = new Set(list.patternTypes.map((pt) => pt.id));
  const typeId =
    typeof raw.typeId === "string" && typeIds.has(raw.typeId)
      ? raw.typeId
      : (list.patternTypes[0]?.id ?? "");
  const counts =
    typeof raw.counts === "number" &&
    Number.isInteger(raw.counts) &&
    raw.counts >= 0
      ? raw.counts
      : 0;
  const patternIds = new Set(patterns.map((p) => p.id));
  const prerequisites = Array.isArray(raw.prerequisites)
    ? [
        ...new Set(
          raw.prerequisites.filter(
            (id): id is number => typeof id === "number" && patternIds.has(id),
          ),
        ),
      ]
    : [];
  const tags = Array.isArray(raw.tags)
    ? [
        ...new Set(
          raw.tags
            .filter((tag): tag is string => typeof tag === "string")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ].slice(0, MAX_TAGS)
    : [];
  const attachable = new Set(
    (list.modifiers ?? []).filter((m) => !m.universal).map((m) => m.id),
  );
  const seenModifiers = new Set<string>();
  const modifierRefs: IPatternModifierRef[] = Array.isArray(raw.modifierRefs)
    ? raw.modifierRefs
        .filter(
          (m): m is Record<string, unknown> =>
            isObject(m) &&
            typeof m.modifierId === "string" &&
            attachable.has(m.modifierId) &&
            !seenModifiers.has(m.modifierId) &&
            !!seenModifiers.add(m.modifierId),
        )
        .map((m) => ({
          modifierId: m.modifierId as string,
          videoRefs: asVideoRefs(m.videoRefs),
        }))
    : [];
  // Any of the list's own levels; one it does not have (any more) is dropped.
  const levels = resolveLevelIds(list.levels);
  const level =
    typeof raw.level === "string" && levels.includes(raw.level)
      ? raw.level
      : undefined;
  const rhythm =
    typeof raw.rhythm === "string" && rhythmMatchesCounts(raw.rhythm, counts)
      ? raw.rhythm
      : undefined;

  return {
    name,
    typeId,
    counts,
    ...(level && { level }),
    ...(rhythm && { rhythm }),
    prerequisites,
    description:
      typeof raw.description === "string"
        ? raw.description.slice(0, MAX_DESCRIPTION)
        : "",
    tags,
    videoRefs: asVideoRefs(raw.videoRefs),
    modifierRefs,
  };
}
