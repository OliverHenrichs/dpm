import type { Dance } from "@/src/pattern/types/Dance";
import {
  IModifier,
  IPattern,
  IPatternList,
  ISequence,
  ISequenceFigureStep,
  ISequenceFreeStep,
  ISequenceStep,
} from "@/src/pattern/types/IPatternList";
import { generateUUID, PatternType } from "@/src/pattern/types/PatternType";
import { effectiveVariant } from "@/src/pattern/types/VariantOverrides";
import { fuzzyFilter } from "@/src/common/utils/fuzzyMatch";

/*
 * Sequences (#136): named runs of a list's figures in dancing order. Pure logic, shared by the
 * List tab, `usePatternCrud` and the import repairs (`normalizeList`).
 */

/** At most this many sequences on a list: keeps a published list far under Firestore's 1 MiB. */
export const MAX_SEQUENCES = 50;
/** At most this many steps in one sequence. */
export const MAX_SEQUENCE_STEPS = 200;
/** As a list's name in the security rules. */
export const MAX_SEQUENCE_NAME = 200;
export const MAX_SEQUENCE_DESCRIPTION = 2000;
/** A free step's text, and a step's note. */
export const MAX_STEP_TEXT = 200;
export const MAX_STEP_NOTE = 500;

/**
 * The dances counted in eights, whose sequences also show their length in eights. Salsa and
 * bachata: three steps and a pause or tap on 4 and 8 (`src/pattern/rhythm/rhythm.ts`).
 */
export const EIGHT_COUNT_DANCES: readonly Dance[] = ["salsa", "bachata"];

export const newSequenceId = generateUUID;

export function figureStep(
  patternId: number,
  modifierId?: string,
): ISequenceFigureStep {
  return {
    kind: "figure",
    id: generateUUID(),
    patternId,
    ...(modifierId && { modifierId }),
  };
}

export function freeStep(text = "", counts?: number): ISequenceFreeStep {
  return {
    kind: "free",
    id: generateUUID(),
    text,
    ...(counts !== undefined && { counts }),
  };
}

/**
 * The variants a figure can be danced as in a step: the modifiers attached to it, then the
 * universal ones, as `ModifierPillStrip` orders them.
 */
export function stepVariants(
  pattern: IPattern,
  modifiers: IModifier[],
): IModifier[] {
  const attached = modifiers.filter(
    (m) =>
      !m.universal &&
      (pattern.modifierRefs ?? []).some((ref) => ref.modifierId === m.id),
  );
  return [...attached, ...modifiers.filter((m) => m.universal)];
}

/** The step's variant when it is still one its figure has, else undefined (the plain figure). */
export function stepVariant(
  step: ISequenceFigureStep,
  pattern: IPattern | undefined,
  modifiers: IModifier[],
): IModifier | undefined {
  if (!step.modifierId || !pattern) return undefined;
  return stepVariants(pattern, modifiers).find((m) => m.id === step.modifierId);
}

/**
 * How many counts a step takes: its figure's, or its variant's when that has its own
 * (`effectiveVariant`); a free step's own. Undefined when unknown (a free step without counts,
 * a figure no longer on the list).
 */
export function stepCounts(
  step: ISequenceStep,
  patterns: IPattern[],
  modifiers: IModifier[],
): number | undefined {
  if (step.kind === "free") return step.counts;
  const pattern = patterns.find((p) => p.id === step.patternId);
  if (!pattern) return undefined;
  const variant = stepVariant(step, pattern, modifiers);
  const ref = variant
    ? (pattern.modifierRefs ?? []).find((r) => r.modifierId === variant.id)
    : undefined;
  const counts = effectiveVariant(pattern, ref).counts;
  return counts > 0 ? counts : undefined;
}

export interface SequenceTotals {
  steps: number;
  counts: number;
  /**
   * The length in eights, for a dance counted in eights, when every step that has counts fills
   * whole eights; otherwise undefined and only the counts show.
   */
  eights?: number;
}

export function sequenceTotals(
  steps: ISequenceStep[],
  patterns: IPattern[],
  modifiers: IModifier[],
  dance?: Dance,
): SequenceTotals {
  const counts = steps.map((step) => stepCounts(step, patterns, modifiers));
  const total = counts.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  const inEights =
    !!dance &&
    EIGHT_COUNT_DANCES.includes(dance) &&
    total > 0 &&
    counts.every((c) => c === undefined || c % 8 === 0);
  return {
    steps: steps.length,
    counts: total,
    ...(inEights && { eights: total / 8 }),
  };
}

/** The sequences with a step of this figure, in the list's order. */
export function sequencesUsing(
  sequences: ISequence[] | undefined,
  patternId: number,
): ISequence[] {
  return (sequences ?? []).filter((sequence) =>
    sequence.steps.some(
      (step) => step.kind === "figure" && step.patternId === patternId,
    ),
  );
}

/**
 * The sequences once `pattern` is deleted: each of its steps becomes a free step with the
 * figure's name (and variant), its counts and note, so the sequence keeps its shape. The same
 * array when no sequence uses it.
 */
export function freeStepsOf(
  sequences: ISequence[] | undefined,
  pattern: IPattern,
  modifiers: IModifier[],
): ISequence[] | undefined {
  if (!sequences || sequencesUsing(sequences, pattern.id).length === 0) {
    return sequences;
  }
  return sequences.map((sequence) => {
    if (!sequencesUsing([sequence], pattern.id).length) return sequence;
    return {
      ...sequence,
      steps: sequence.steps.map((step): ISequenceStep => {
        if (step.kind !== "figure" || step.patternId !== pattern.id) {
          return step;
        }
        const variant = stepVariant(step, pattern, modifiers);
        const counts = stepCounts(step, [pattern], modifiers);
        const text = variant
          ? `${pattern.name} (${variant.name})`
          : pattern.name;
        return {
          kind: "free",
          id: step.id,
          text: text.slice(0, MAX_STEP_TEXT),
          ...(counts !== undefined && { counts }),
          ...(step.note && { note: step.note }),
        };
      }),
    };
  });
}

/** The sequences once a modifier is deleted: steps danced with it become the plain figure. */
export function withoutVariant(
  sequences: ISequence[] | undefined,
  modifierId: string,
): ISequence[] | undefined {
  if (!sequences) return sequences;
  return sequences.map((sequence) => ({
    ...sequence,
    steps: sequence.steps.map((step) => {
      if (step.kind !== "figure" || step.modifierId !== modifierId) {
        return step;
      }
      const { modifierId: _gone, ...rest } = step;
      return rest;
    }),
  }));
}

/**
 * A sequence as it is saved: name and texts trimmed and cut to their limits, optional fields
 * absent rather than empty (Firestore refuses `undefined`), a variant its figure no longer has
 * dropped, and at most `MAX_SEQUENCE_STEPS` steps.
 */
export function cleanSequence(
  sequence: ISequence,
  patterns: IPattern[],
  modifiers: IModifier[],
): ISequence {
  const description = sequence.description
    ?.trim()
    .slice(0, MAX_SEQUENCE_DESCRIPTION);
  const steps = sequence.steps
    .slice(0, MAX_SEQUENCE_STEPS)
    .map((step): ISequenceStep => {
      const note = step.note?.trim().slice(0, MAX_STEP_NOTE);
      if (step.kind === "free") {
        return {
          kind: "free",
          id: step.id,
          text: step.text.trim().slice(0, MAX_STEP_TEXT),
          ...(isCount(step.counts) && { counts: step.counts }),
          ...(note && { note }),
        };
      }
      const pattern = patterns.find((p) => p.id === step.patternId);
      const variant = stepVariant(step, pattern, modifiers);
      return {
        kind: "figure",
        id: step.id,
        patternId: step.patternId,
        ...(variant && { modifierId: variant.id }),
        ...(note && { note }),
      };
    });
  return {
    id: sequence.id,
    name: sequence.name.trim().slice(0, MAX_SEQUENCE_NAME),
    ...(description && { description }),
    steps,
    createdAt: sequence.createdAt,
  };
}

/** A positive whole number of counts. */
export const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

/** A step whose free text is blank says nothing: Save asks for text first. */
export const blankFreeStep = (step: ISequenceStep) =>
  step.kind === "free" && !step.text.trim();

/** `list` with `sequences`, or without the key when there are none (absent rather than empty). */
export function withSequences<T extends IPatternList>(
  list: T,
  sequences: ISequence[] | undefined,
): T {
  const { sequences: _old, ...rest } = list;
  return (sequences?.length ? { ...rest, sequences } : rest) as T;
}

/** `steps` with the one at `from` moved to `to`. */
export function moveStep<T>(steps: readonly T[], from: number, to: number) {
  const moved = [...steps];
  if (from < 0 || from >= steps.length || to < 0 || to >= steps.length) {
    return moved;
  }
  const [step] = moved.splice(from, 1);
  moved.splice(to, 0, step);
  return moved;
}

/** `steps` with a copy of the one at `index` right after it, under a new id. */
export function duplicateStep(
  steps: readonly ISequenceStep[],
  index: number,
): ISequenceStep[] {
  const step = steps[index];
  if (!step || steps.length >= MAX_SEQUENCE_STEPS) return [...steps];
  return [
    ...steps.slice(0, index + 1),
    { ...step, id: generateUUID() },
    ...steps.slice(index + 1),
  ];
}

/** One type's figures in the step picker. */
export interface StepPickerGroup {
  type: PatternType | undefined;
  patterns: IPattern[];
}

/**
 * The step picker's figures: grouped by type in the list's order of types (a figure whose type
 * the list lacks last), by name within a type, narrowed fuzzily by `query` (best match first).
 */
export function stepPickerGroups(
  patterns: IPattern[],
  patternTypes: PatternType[],
  query: string,
): StepPickerGroup[] {
  const trimmed = query.trim();
  const byName = [...patterns].sort((a, b) => a.name.localeCompare(b.name));
  const shown = trimmed ? fuzzyFilter(byName, trimmed, (p) => p.name) : byName;
  const known = new Set(patternTypes.map((type) => type.id));
  const groups: StepPickerGroup[] = patternTypes.map((type) => ({
    type,
    patterns: shown.filter((p) => p.typeId === type.id),
  }));
  groups.push({
    type: undefined,
    patterns: shown.filter((p) => !known.has(p.typeId)),
  });
  return groups.filter((group) => group.patterns.length > 0);
}
