import { PatternType } from "./PatternType";

/**
 * Represents a collection of patterns for a specific dance style.
 * Contains metadata and pattern type definitions.
 */
export interface PatternList {
  id: string; // UUID for the list
  name: string; // Display name (e.g., "West Coast Swing", "Salsa")
  patternTypes: PatternType[]; // Available pattern types for this list
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

/**
 * Pattern data structure updated to use typeId instead of enum
 */
export interface Pattern {
  id: number;
  name: string;
  typeId: string; // References PatternType.id
  counts: number;
  level?: string; // Optional level (beginner, intermediate, advanced)
  prerequisites: number[];
  description: string;
  tags: string[];
  videoRefs: VideoReference[];
}

export interface VideoReference {
  type: "url" | "local";
  value: string; // URL or local file path
}

/**
 * Type for creating a new pattern (without id)
 */
export type NewPattern = Omit<Pattern, "id">;
