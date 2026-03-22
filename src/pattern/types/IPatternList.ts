import { PatternType } from "./PatternType";

/**
 * Represents a collection of patterns for a specific dance style.
 * Contains metadata and pattern type definitions.
 */
export interface IPatternList {
  id: string; // UUID for the list
  name: string; // Display name (e.g., "West Coast Swing", "Salsa")
  patternTypes: PatternType[]; // Available pattern types for this list
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
  readonly?: boolean; // When true, the list was exported as read-only and cannot be edited by the importer
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
}

export interface IVideoReference {
  type: "url" | "local";
  value: string; // URL or local file path
}

/**
 * Type for creating a new pattern (without id)
 */
export type NewPattern = Omit<IPattern, "id">;
