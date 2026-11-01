import { generateUUID } from "./PatternType";

/**
 * The ids of the three built-in levels, which are also their i18n keys. A list without
 * `levels` has exactly these, in this order, named in the app's language. They are the strings
 * figures carried before lists had levels of their own, so nothing needed migrating.
 */
export enum PatternLevel {
  BEGINNER = "beginner",
  INTERMEDIATE = "intermediate",
  ADVANCED = "advanced",
}

/**
 * One of a list's levels (`IPatternList.levels`). A figure's `level` holds the id, so renaming a
 * level renames it on every figure.
 */
export interface IPatternLevel {
  /** A built-in id (`PatternLevel`) or a random one (`newLevelId`). */
  id: string;
  /** What the level is called, as the list owner wrote it. */
  name: string;
}

/** How many levels a list may have: beyond this the Map's shading no longer tells them apart. */
export const MAX_LEVELS = 12;

/** How long a level's name may be. */
export const MAX_LEVEL_NAME_LENGTH = 40;

export const BUILT_IN_LEVEL_IDS: readonly string[] =
  Object.values(PatternLevel);

type Translate = (key: string) => string;

/** The three built-in levels, named in the app's language. */
export function builtInLevels(t: Translate): IPatternLevel[] {
  return BUILT_IN_LEVEL_IDS.map((id) => ({ id, name: t(id) }));
}

/**
 * A list's levels in their order: its own when it has any, else the three built-in ones. Every
 * screen that shows or picks a level goes through this.
 */
export function resolveLevels(
  levels: readonly IPatternLevel[] | undefined,
  t: Translate,
): IPatternLevel[] {
  return levels && levels.length > 0 ? [...levels] : builtInLevels(t);
}

/** The ids of a list's levels in their order, without needing their names. */
export function resolveLevelIds(
  levels: readonly IPatternLevel[] | undefined,
): readonly string[] {
  return levels && levels.length > 0
    ? levels.map((level) => level.id)
    : BUILT_IN_LEVEL_IDS;
}

/**
 * What a figure's level is called in its list, or undefined when it has none or one the list does
 * not have (an older or odd import): such a figure shows as having no level.
 */
export function levelName(
  levels: readonly IPatternLevel[] | undefined,
  id: string | undefined,
  t: Translate,
): string | undefined {
  if (!id) return undefined;
  return resolveLevels(levels, t).find((level) => level.id === id)?.name;
}

/**
 * A new level's id: a UUID without its dashes. 32 characters, so a figure carrying it still fits
 * the security rules' bound on a suggested figure's `level`.
 */
export function newLevelId(): string {
  return generateUUID().replace(/-/g, "");
}

/**
 * The levels to store on a list: absent (undefined) when they are exactly the built-in three
 * under their names in this language, so an untouched list keeps following the app's language.
 */
export function storedLevels(
  levels: readonly IPatternLevel[],
  t: Translate,
): IPatternLevel[] | undefined {
  const builtIn = builtInLevels(t);
  const isBuiltIn =
    levels.length === builtIn.length &&
    levels.every(
      (level, i) =>
        level.id === builtIn[i].id && level.name === builtIn[i].name,
    );
  return isBuiltIn ? undefined : levels.map(({ id, name }) => ({ id, name }));
}

/** The presets list settings offer to start the levels from. */
export type LevelPreset = "builtIn" | "numbers" | "ownNames";

/**
 * `levels` restarted from a preset. The ids already there are kept in their places and only
 * renamed, so the figures on the first level stay on the first level (Beginner becomes 1); a
 * preset longer than the levels adds new ones, and levels past the preset's length stay as
 * they are, so applying a preset never takes a level from a figure. "Own names" blanks the
 * names for the user to type.
 */
export function applyLevelPreset(
  levels: readonly IPatternLevel[],
  preset: LevelPreset,
  t: Translate,
): IPatternLevel[] {
  const names =
    preset === "builtIn"
      ? BUILT_IN_LEVEL_IDS.map((id) => t(id))
      : preset === "numbers"
        ? ["1", "2", "3"]
        : levels.length > 0
          ? levels.map(() => "")
          : [""];
  const result: IPatternLevel[] = names.map((name, i) => {
    const existing = levels[i];
    if (existing) return { id: existing.id, name };
    // A fresh list starting from the built-ins takes their ids, so it stores no levels at all.
    const builtInId = preset === "builtIn" ? BUILT_IN_LEVEL_IDS[i] : undefined;
    const taken = levels.some((level) => level.id === builtInId);
    return { id: builtInId && !taken ? builtInId : newLevelId(), name };
  });
  return [...result, ...levels.slice(names.length)];
}

/**
 * The name a new level starts with: the next number when the levels are numbered 1, 2, 3 …,
 * else empty for the user to type.
 */
export function nextLevelName(levels: readonly IPatternLevel[]): string {
  if (levels.length === 0) return "";
  const numbered = levels.every(
    (level, i) => level.name.trim() === String(i + 1),
  );
  return numbered ? String(levels.length + 1) : "";
}

/**
 * Why each level's name cannot be saved, by level id: empty, or a name another level has
 * (ignoring case and spaces at the ends). Empty when every name is fine.
 */
export function levelNameErrors(
  levels: readonly IPatternLevel[],
): Record<string, "empty" | "duplicate"> {
  const errors: Record<string, "empty" | "duplicate"> = {};
  const key = (name: string) => name.trim().toLowerCase();
  levels.forEach((level, i) => {
    if (!key(level.name)) errors[level.id] = "empty";
    else if (
      levels.some((o, j) => j !== i && key(o.name) === key(level.name))
    ) {
      errors[level.id] = "duplicate";
    }
  });
  return errors;
}
