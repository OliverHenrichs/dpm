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
}

/**
 * Type for creating a new pattern (without id)
 */
export type NewPattern = Omit<IPattern, "id">;
