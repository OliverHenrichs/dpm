import {
  normalizeRhythm,
  rhythmMatchesCounts,
  Timing,
} from "@/src/pattern/rhythm/rhythm";
import type {
  IPattern,
  IPatternModifierRef,
  IVariantOverrides,
} from "./IPatternList";

/**
 * A variant's own values in place of its figure's (#134): counts and rhythm, level and
 * description. Name, type, prerequisites and tags are the figure's for every variant; videos
 * belong to the attachment (`IPatternModifierRef.videoRefs`). Only an attached (non-universal)
 * modifier's variant has overrides.
 *
 * Counts and rhythm go together: a variant with its own counts has its own timing, rhythm or
 * none, and a rhythm is kept only with counts it matches (src/pattern/rhythm/AGENTS.md).
 */

/** The longest description a variant keeps, as a figure's (`isSuggestedPattern` in the rules). */
export const MAX_VARIANT_DESCRIPTION = 2000;
/** A rhythm cannot be cut and still match its counts, so a longer one is dropped. */
export const MAX_VARIANT_RHYTHM = 200;

/** The figure's fields a variant can override. */
export type VariantFigure = Pick<
  IPattern,
  "counts" | "rhythm" | "level" | "description"
>;

/** What a variant is danced as: its own values where it has them, else its figure's. */
export interface EffectiveVariant {
  counts: number;
  rhythm?: string;
  level?: string;
  description: string;
}

/** The overridable fields of a field group, for a reset. */
export type OverrideField = "timing" | "level" | "description";

const sameTiming = (a: Timing, b: Timing) =>
  a.counts === b.counts && (a.rhythm ?? "") === (b.rhythm ?? "");

/** The figure's values, or the variant's own in place of those it overrides. */
export function effectiveVariant(
  figure: VariantFigure,
  ref?: Pick<IPatternModifierRef, "overrides">,
): EffectiveVariant {
  const own = ref?.overrides;
  const timing: Timing =
    own?.counts !== undefined
      ? { counts: own.counts, rhythm: own.rhythm }
      : { counts: figure.counts, rhythm: figure.rhythm };
  const rhythm = timing.rhythm;
  const level = own?.level ?? figure.level;
  return {
    counts: timing.counts as number,
    ...(rhythm && { rhythm }),
    ...(level && { level }),
    description: own?.description ?? figure.description ?? "",
  };
}

/**
 * Only the overrides that differ from the figure, or undefined when none do: equal counts and
 * rhythm, an equal level or an equal description follow the figure again.
 */
export function compactOverrides(
  figure: VariantFigure,
  overrides: IVariantOverrides | undefined,
): IVariantOverrides | undefined {
  if (!overrides) return undefined;
  const { counts, rhythm, level, description } = overrides;
  const ownTiming =
    counts !== undefined &&
    !sameTiming(
      { counts, rhythm },
      { counts: figure.counts, rhythm: figure.rhythm },
    );
  const out: IVariantOverrides = {
    ...(ownTiming && { counts }),
    ...(ownTiming && rhythm && { rhythm }),
    ...(level !== undefined && level !== figure.level && { level }),
    ...(description !== undefined &&
      description !== (figure.description ?? "") && { description }),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

/** `ref` holding `overrides`, or without the key when there are none. */
export function withOverrides<T extends IPatternModifierRef>(
  ref: T,
  overrides: IVariantOverrides | undefined,
): T {
  const { overrides: _old, ...rest } = ref;
  return (overrides ? { ...rest, overrides } : rest) as T;
}

/** `ref` with `edit` applied to its overrides, keeping only what differs from `figure`. */
export function editOverrides<T extends IPatternModifierRef>(
  figure: VariantFigure,
  ref: T,
  edit: (overrides: IVariantOverrides) => IVariantOverrides,
): T {
  return withOverrides(
    ref,
    compactOverrides(figure, edit({ ...ref.overrides })),
  );
}

/** The variant's counts and rhythm set to `timing` (its counts required). */
export function overrideTiming<T extends IPatternModifierRef>(
  figure: VariantFigure,
  ref: T,
  timing: Timing,
): T {
  return editOverrides(figure, ref, ({ counts: _c, rhythm: _r, ...rest }) => ({
    ...rest,
    ...(timing.counts !== undefined && { counts: timing.counts }),
    ...(timing.counts !== undefined &&
      timing.rhythm && { rhythm: timing.rhythm }),
  }));
}

/** `ref` following its figure again for `field`. */
export function resetOverride<T extends IPatternModifierRef>(
  figure: VariantFigure,
  ref: T,
  field: OverrideField,
): T {
  return editOverrides(
    figure,
    ref,
    ({ counts, rhythm, level, description }) => ({
      ...(field !== "timing" && counts !== undefined && { counts }),
      ...(field !== "timing" && rhythm && { rhythm }),
      ...(field !== "level" && level !== undefined && { level }),
      ...(field !== "description" &&
        description !== undefined && { description }),
    }),
  );
}

/** Which of the variant's shown values are its own, for the form's marks. */
export function ownFields(figure: VariantFigure, ref?: IPatternModifierRef) {
  const own = ref?.overrides;
  const ownTiming = own?.counts !== undefined;
  return {
    counts: ownTiming && own.counts !== figure.counts,
    rhythm: ownTiming && (own.rhythm ?? "") !== (figure.rhythm ?? ""),
    level: own?.level !== undefined,
    description: own?.description !== undefined,
  };
}

/**
 * Each attached variant of `pattern` with only the overrides that still differ from it: the
 * figure may have changed to match one. Called on save.
 */
export function prunedVariantOverrides<
  T extends VariantFigure & {
    modifierRefs: IPatternModifierRef[];
  },
>(pattern: T): T {
  return {
    ...pattern,
    modifierRefs: (pattern.modifierRefs ?? []).map((ref) =>
      withOverrides(ref, compactOverrides(pattern, ref.overrides)),
    ),
  };
}

/** What `parseOverrides` made of untrusted overrides. */
export interface ParsedOverrides {
  overrides?: IVariantOverrides;
  /** A rhythm was there but was dropped: it did not match the counts, or there were none. */
  rhythmDropped: boolean;
}

/**
 * A variant's overrides from a file, a published list or another phone's suggestion, made safe:
 * counts a positive whole number; a rhythm only alongside counts it matches (normalised); a
 * level a non-empty string (one of `levelIds`, when given); a description a string, cut at
 * `MAX_VARIANT_DESCRIPTION`. Anything else is dropped, and nothing left drops the whole.
 */
export function parseOverrides(
  raw: unknown,
  levelIds?: readonly string[],
): ParsedOverrides {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { rhythmDropped: false };
  }
  const o = raw as Record<string, unknown>;
  const counts =
    typeof o.counts === "number" && Number.isInteger(o.counts) && o.counts > 0
      ? o.counts
      : undefined;
  const rhythmOk =
    counts !== undefined &&
    typeof o.rhythm === "string" &&
    o.rhythm.length <= MAX_VARIANT_RHYTHM &&
    rhythmMatchesCounts(o.rhythm, counts);
  const level =
    typeof o.level === "string" &&
    o.level !== "" &&
    (!levelIds || levelIds.includes(o.level))
      ? o.level
      : undefined;
  const description =
    typeof o.description === "string"
      ? o.description.slice(0, MAX_VARIANT_DESCRIPTION)
      : undefined;
  const overrides: IVariantOverrides = {
    ...(counts !== undefined && { counts }),
    ...(rhythmOk && { rhythm: normalizeRhythm(o.rhythm as string) }),
    ...(level !== undefined && { level }),
    ...(description !== undefined && { description }),
  };
  return {
    ...(Object.keys(overrides).length > 0 && { overrides }),
    rhythmDropped: o.rhythm !== undefined && !rhythmOk,
  };
}
