import { PatternList } from "../types/PatternList";
import {
  generateUUID,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "../types/PatternType";

/**
 * Create default pattern lists that users can add from templates.
 * Each list comes with predefined pattern types and colors.
 */

/**
 * West Coast Swing default pattern list
 */
export function createWestCoastSwingList(): PatternList {
  return createPatternList("West Coast Swing", [
    createPatternType("push", PATTERN_TYPE_COLORS.coral),
    createPatternType("pass", PATTERN_TYPE_COLORS.teal),
    createPatternType("whip", PATTERN_TYPE_COLORS.violet),
    createPatternType("tuck", PATTERN_TYPE_COLORS.amber),
  ]);
}

/**
 * Salsa default pattern list
 */
export function createSalsaList(): PatternList {
  return createPatternList("Salsa", [
    createPatternType("basic", PATTERN_TYPE_COLORS.emerald),
    createPatternType("cross-body-lead", PATTERN_TYPE_COLORS.azure),
    createPatternType("right-turn", PATTERN_TYPE_COLORS.rose),
    createPatternType("left-turn", PATTERN_TYPE_COLORS.lime),
    createPatternType("shine", PATTERN_TYPE_COLORS.indigo),
  ]);
}

/**
 * Bachata default pattern list
 */
export function createBachataList(): PatternList {
  return createPatternList("Bachata", [
    createPatternType("basic", PATTERN_TYPE_COLORS.emerald),
    createPatternType("turn", PATTERN_TYPE_COLORS.violet),
    createPatternType("dip", PATTERN_TYPE_COLORS.coral),
    createPatternType("wave", PATTERN_TYPE_COLORS.cyan),
  ]);
}

/**
 * Tango default pattern list
 */
export function createTangoList(): PatternList {
  return createPatternList("Argentine Tango", [
    createPatternType("basic", PATTERN_TYPE_COLORS.emerald),
    createPatternType("ocho", PATTERN_TYPE_COLORS.violet),
    createPatternType("giro", PATTERN_TYPE_COLORS.azure),
    createPatternType("gancho", PATTERN_TYPE_COLORS.magenta),
    createPatternType("boleo", PATTERN_TYPE_COLORS.orange),
  ]);
}

/**
 * Lindy Hop default pattern list
 */
export function createLindyHopList(): PatternList {
  return createPatternList("Lindy Hop", [
    createPatternType("swing-out", PATTERN_TYPE_COLORS.coral),
    createPatternType("circle", PATTERN_TYPE_COLORS.teal),
    createPatternType("tuck-turn", PATTERN_TYPE_COLORS.amber),
    createPatternType("aerial", PATTERN_TYPE_COLORS.rose),
  ]);
}

function createPatternList(name: string, types: PatternType[]): PatternList {
  const now = Date.now();
  return {
    id: generateUUID(),
    name,
    patternTypes: types,
    createdAt: now,
    updatedAt: now,
  };
}

function createPatternType(slug: string, color: string): PatternType {
  return {
    id: generateUUID(),
    slug,
    color,
  };
}
