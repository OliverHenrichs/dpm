import type { Dance } from "@/src/pattern/types/Dance";
import { PatternType } from "./PatternType";
import type { IPatternLevel } from "./PatternLevel";

export type { IPatternLevel } from "./PatternLevel";

/**
 * Where in the execution of a pattern a modifier applies.
 */
export type ModifierPosition = "prefix" | "postfix" | "amends";

/**
 * A modifier (affix) that can be applied to patterns.
 * Universal modifiers apply to every pattern in the list and carry their own videos.
 * Non-universal modifiers are attached per-pattern and each attachment carries its own videos.
 */
export interface IModifier {
  id: string; // UUID
  name: string;
  position: ModifierPosition; // precedes / follows / modifies within
  universal: boolean;
  videoRefs: IVideoReference[]; // only used when universal === true
  /** What the modifier changes, in a sentence. Optional; absent rather than empty. */
  description?: string;
}

/**
 * A reference from a specific pattern to a non-universal modifier,
 * including videos that show the pattern executed with that modifier.
 */
export interface IPatternModifierRef {
  modifierId: string; // References IModifier.id
  videoRefs: IVideoReference[];
  /**
   * What this variant has of its own in place of its figure's (`VariantOverrides.ts`). Only the
   * fields that differ; absent when none do. Only an attached (non-universal) modifier's
   * variant has any.
   */
  overrides?: IVariantOverrides;
}

/**
 * A variant's own values (#134): counts and rhythm (a rhythm only with counts it matches; with
 * counts, the variant's timing is its own, rhythm or none), level (a level id) and description.
 * A field left out follows the figure. Never holds `undefined`, which Firestore refuses.
 */
export interface IVariantOverrides {
  counts?: number;
  rhythm?: string;
  level?: string;
  description?: string;
}

/** Type for creating a new modifier (without id) */
export type NewModifier = Omit<IModifier, "id">;

/**
 * Represents a collection of patterns for a specific dance style.
 * Contains metadata and pattern type definitions.
 */
export interface IPatternList {
  id: string; // UUID for the list
  name: string; // Display name (e.g., "West Coast Swing", "Salsa")
  patternTypes: PatternType[]; // Available pattern types for this list
  modifiers: IModifier[]; // List-level modifiers (universal + non-universal definitions)
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  readonly?: boolean; // When true, the list was exported as read-only and cannot be edited by the importer
  shareCode?: string; // Firestore document ID when this list is published to the cloud
  /**
   * The publisher's secret for the published list (`src/firebase/shareKey.ts`).
   * Present exactly when the list has a `shareCode` and is not `readonly`;
   * `savePatternList` keeps that true. Never published; left out of read-only
   * exports.
   */
  shareKey?: string;
  /**
   * High-water mark for pattern ids: the next one to hand out, never one that
   * has been used before.
   *
   * Optional because lists written before it existed do not have it, and
   * `nextPatternId()` falls back to the patterns present. See that function
   * for why there is no migration.
   */
  nextPatternId?: number;
  /** The dance the list is for: its terms help transcription. Absent means none in particular. */
  dance?: Dance;
  /**
   * Whether subscribers of the published list may suggest new patterns, and how many a day
   * (`src/pattern/suggestions/`). Absent means they may not. Published with the list, so a
   * subscriber's copy says whether to offer it; the security rules enforce it.
   */
  suggestions?: ISuggestionPolicy;
  /**
   * Whether only the subscribers the publisher has let in may read the published list
   * (`src/pattern/members/`). Absent means anyone with the share code may. Published with the
   * list; the security rules enforce it.
   */
  membersOnly?: true;
  /**
   * The timeline's lanes as the user dragged them, top to bottom, as type ids (`orderLanes`).
   * Absent means the automatic order, which keeps linked types together; _Reset to automatic_
   * removes the key. Types it does not name follow in their automatic place. Published with the
   * list, so subscribers see the owner's lanes.
   */
  laneOrder?: string[];
  /**
   * The list's levels, easiest first (`resolveLevels`). Absent means the three built-in ones
   * (Beginner, Intermediate, Advanced, named in the app's language). A figure's `level` holds a
   * level's id; one the list does not have shows as no level. At most `MAX_LEVELS`. Published
   * with the list, so subscribers see the owner's level names.
   */
  levels?: IPatternLevel[];
  /**
   * Named runs of the list's figures in the order they are danced (`src/pattern/sequences/`),
   * at most `MAX_SEQUENCES`. Absent rather than empty. Published and exported with the list.
   */
  sequences?: ISequence[];
}

/** A named, ordered run of a list's figures: a routine, a Rallye, a workshop combination. */
export interface ISequence {
  id: string; // UUID
  name: string;
  /** Absent rather than empty. */
  description?: string;
  /** In dancing order, at most `MAX_SEQUENCE_STEPS`. */
  steps: ISequenceStep[];
  createdAt: number;
}

/**
 * One step of a sequence: a figure of the list, or free text for what is not one ("pose").
 * `id` keeps a step apart from another of the same figure when steps are reordered.
 */
export type ISequenceStep = ISequenceFigureStep | ISequenceFreeStep;

export interface ISequenceFigureStep {
  kind: "figure";
  id: string;
  patternId: number;
  /** The variant danced: a universal modifier, or one attached to that figure. Absent = plain. */
  modifierId?: string;
  note?: string;
}

export interface ISequenceFreeStep {
  kind: "free";
  id: string;
  text: string;
  /** A positive whole number, or absent. */
  counts?: number;
  /** Carried over from a figure step whose figure was deleted. */
  note?: string;
}

/** How many pattern suggestions a published list takes a day (UTC), counted for whom. */
export interface ISuggestionPolicy {
  /** 1 to `MAX_SUGGESTIONS_PER_DAY`. */
  dailyLimit: number;
  /** `list`: one limit shared by every subscriber; `subscriber`: each gets the limit. */
  per: "list" | "subscriber";
  /**
   * Whether subscribers may also suggest changes to existing figures (`figureEdits.ts`). They
   * count against the same daily limit. Absent means new figures only.
   */
  edits?: true;
}

/**
 * Pattern data structure updated to use typeId instead of enum
 */
export interface IPattern {
  id: number;
  name: string;
  typeId: string; // References PatternType.id
  counts: number;
  /** Optional: the id of one of the list's levels (`IPatternList.levels`). */
  level?: string;
  /** How the steps fall on the counts ("1 2 3&4 5&6"); always matches `counts`. See src/pattern/rhythm/. */
  rhythm?: string;
  prerequisites: number[];
  description: string;
  tags: string[];
  videoRefs: IVideoReference[];
  modifierRefs: IPatternModifierRef[]; // Non-universal modifiers attached to this pattern
  /**
   * Epoch milliseconds when the pattern was added, for the day headers of the date sort.
   * Patterns added before it was kept have none. Never published.
   */
  createdAt?: number;
}

export interface IVideoReference {
  type: "url" | "local";
  value: string; // URL or local file path
  startTime?: number; // Optional start time in seconds (URL-type videos only)
  /** Set on a video the app made from another — e.g. anonymized silhouettes (L3). */
  generated?: IGeneratedVideo;
  /**
   * What is said in the video, transcribed on the device (L4). Never in shared lists, and in
   * exports only when the user opts in: it is someone's words, often said off-hand.
   */
  transcript?: IVideoTranscript;
}

/** A transcript of a video's speech (L4). */
export interface IVideoTranscript {
  /** ISO 639-1 code, as detected or chosen. */
  language: string;
  /** Which model made it, e.g. "whisper-base-q5_1" — to know what re-running would change. */
  model: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /**
   * Epoch milliseconds of the user's last correction to a line, when they made one: the model
   * mishears dance slang. Transcribing again replaces the corrections, so the app says so.
   */
  editedAt?: number;
  /** In playback order. Empty when the video has sound but no speech. */
  segments: ITranscriptSegment[];
}

export interface ITranscriptSegment {
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  text: string;
}

/** Provenance of a video the app generated; shown as a badge, carried through export. */
export interface IGeneratedVideo {
  /** How it was made, e.g. the anonymization provider's id. */
  method: string;
  /** Epoch milliseconds. */
  createdAt: number;
}

/**
 * Type for creating a new pattern (without id)
 */
export type NewPattern = Omit<IPattern, "id">;
