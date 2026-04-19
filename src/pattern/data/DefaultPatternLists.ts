import { IPatternList, NewPattern } from "../types/IPatternList";
import {
  generateUUID,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "../types/PatternType";

/**
 * A pattern definition relative to a template — uses typeSlug instead of a
 * resolved typeId so it stays valid even when the user renames/reorders types.
 */
export interface TemplatePattern {
  name: string;
  typeSlug: string;
  counts: number;
  level?: string;
  description: string;
}

/**
 * Create default pattern lists that users can add from templates.
 * Each list comes with predefined pattern types and colors.
 */

/**
 * West Coast Swing default pattern list
 */
export function createWestCoastSwingList(): IPatternList {
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
export function createSalsaList(): IPatternList {
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
export function createBachataList(): IPatternList {
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
export function createTangoList(): IPatternList {
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
export function createLindyHopList(): IPatternList {
  return createPatternList("Lindy Hop", [
    createPatternType("swing-out", PATTERN_TYPE_COLORS.coral),
    createPatternType("circle", PATTERN_TYPE_COLORS.teal),
    createPatternType("tuck-turn", PATTERN_TYPE_COLORS.amber),
    createPatternType("aerial", PATTERN_TYPE_COLORS.rose),
  ]);
}

/**
 * Blank pattern list with no preset pattern types or patterns
 */
export function createBlankList(): IPatternList {
  return createPatternList("", []);
}

export function createPatternList(
  name: string,
  types: PatternType[],
): IPatternList {
  const now = Date.now();
  return {
    id: generateUUID(),
    name,
    patternTypes: types,
    modifiers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createPatternType(slug: string, color: string): PatternType {
  return {
    id: generateUUID(),
    slug,
    color,
  };
}

/**
 * Resolve TemplatePatterns to NewPatterns by mapping typeSlug → typeId.
 * Types not found in the provided list are skipped.
 */
export function resolveTemplatePatterns(
  templatePatterns: TemplatePattern[],
  types: PatternType[],
): NewPattern[] {
  const result: NewPattern[] = [];
  for (const tp of templatePatterns) {
    const type = types.find(
      (t) => t.slug.toLowerCase() === tp.typeSlug.toLowerCase(),
    );
    if (!type) continue;
    result.push({
      name: tp.name,
      typeId: type.id,
      counts: tp.counts,
      level: tp.level,
      prerequisites: [],
      description: tp.description,
      tags: [],
      videoRefs: [],
      modifierRefs: [],
    });
  }
  return result;
}

/**
 * Foundational patterns per template id
 */
export const TEMPLATE_FOUNDATIONAL_PATTERNS: Record<string, TemplatePattern[]> =
  {
    wcs: [
      {
        name: "Left Side Pass",
        typeSlug: "pass",
        counts: 6,
        level: "beginner",
        description: "Foundational 6-count pass on the left side of the slot.",
      },
      {
        name: "Sugar Push",
        typeSlug: "push",
        counts: 6,
        level: "beginner",
        description: "Foundational 6-count push pattern staying in the slot.",
      },
      {
        name: "Underarm Turn",
        typeSlug: "pass",
        counts: 6,
        level: "beginner",
        description:
          "6-count pass with follower turning under the leader's arm.",
      },
      {
        name: "Basic Whip",
        typeSlug: "whip",
        counts: 8,
        level: "beginner",
        description: "8-count whip — the signature WCS pattern.",
      },
      {
        name: "Tuck Turn",
        typeSlug: "tuck",
        counts: 6,
        level: "intermediate",
        description: "6-count tuck and redirected turn.",
      },
    ],
    salsa: [
      {
        name: "Basic Step",
        typeSlug: "basic",
        counts: 8,
        level: "beginner",
        description: "Foundational 8-count salsa basic in place.",
      },
      {
        name: "Cross Body Lead",
        typeSlug: "cross-body-lead",
        counts: 8,
        level: "beginner",
        description: "Leader crosses follower across their body.",
      },
      {
        name: "Right Turn",
        typeSlug: "right-turn",
        counts: 8,
        level: "beginner",
        description: "Follower right turn on counts 5-8.",
      },
      {
        name: "Left Turn",
        typeSlug: "left-turn",
        counts: 8,
        level: "beginner",
        description: "Follower left turn on counts 1-4.",
      },
      {
        name: "Basic Shine",
        typeSlug: "shine",
        counts: 8,
        level: "intermediate",
        description: "Follower and leader break apart for solo footwork.",
      },
    ],
    bachata: [
      {
        name: "Basic Step",
        typeSlug: "basic",
        counts: 8,
        level: "beginner",
        description: "Foundational 8-count bachata basic side-to-side.",
      },
      {
        name: "Right Turn",
        typeSlug: "turn",
        counts: 8,
        level: "beginner",
        description: "Follower right turn.",
      },
      {
        name: "Basic Dip",
        typeSlug: "dip",
        counts: 8,
        level: "intermediate",
        description: "Leader dips follower at the end of a basic.",
      },
      {
        name: "Body Wave",
        typeSlug: "wave",
        counts: 8,
        level: "intermediate",
        description: "Follower body wave through the slot.",
      },
    ],
    tango: [
      {
        name: "Basic Walk",
        typeSlug: "basic",
        counts: 8,
        level: "beginner",
        description: "Foundational tango walk in close embrace.",
      },
      {
        name: "Forward Ocho",
        typeSlug: "ocho",
        counts: 4,
        level: "beginner",
        description: "Follower pivots forward in figure-eight.",
      },
      {
        name: "Back Ocho",
        typeSlug: "ocho",
        counts: 4,
        level: "beginner",
        description: "Follower pivots backward in figure-eight.",
      },
      {
        name: "Molinete",
        typeSlug: "giro",
        counts: 8,
        level: "intermediate",
        description: "Follower circles around the leader.",
      },
      {
        name: "Back Gancho",
        typeSlug: "gancho",
        counts: 4,
        level: "advanced",
        description: "Follower hooks leg behind leader's leg.",
      },
    ],
    lindy: [
      {
        name: "Basic Swing Out",
        typeSlug: "swing-out",
        counts: 8,
        level: "beginner",
        description:
          "Foundational 8-count Lindy Hop swing out from closed position.",
      },
      {
        name: "Circle",
        typeSlug: "circle",
        counts: 8,
        level: "beginner",
        description: "Partners circle each other in closed position.",
      },
      {
        name: "Tuck Turn",
        typeSlug: "tuck-turn",
        counts: 8,
        level: "beginner",
        description: "Leader tucks follower through and turns them.",
      },
      {
        name: "Swing Out from Open",
        typeSlug: "swing-out",
        counts: 8,
        level: "intermediate",
        description: "Swing out initiated from open position.",
      },
    ],
  };
