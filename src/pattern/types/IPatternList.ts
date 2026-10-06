import type { Dance } from "@/src/pattern/types/Dance";
import { PatternType } from "./PatternType";

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
}

/**
 * A reference from a specific pattern to a non-universal modifier,
 * including videos that show the pattern executed with that modifier.
 */
export interface IPatternModifierRef {
  modifierId: string; // References IModifier.id
  videoRefs: IVideoReference[];
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
  /** The dance the list is for: which rhythms are suggested. Absent means none in particular. */
  dance?: Dance;
}

/**
 * Pattern data structure updated to use typeId instead of enum
 */
export interface IPattern {
  id: number;
  name: string;
  typeId: string; // References PatternType.id
  counts: number;
  level?: string; // Optional level (beginner, intermediate, advanced)
  /** How the steps fall on the counts ("1 2 3&4 5&6"); always matches `counts`. See src/pattern/rhythm/. */
  rhythm?: string;
  prerequisites: number[];
  description: string;
  tags: string[];
  videoRefs: IVideoReference[];
  modifierRefs: IPatternModifierRef[]; // Non-universal modifiers attached to this pattern
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
