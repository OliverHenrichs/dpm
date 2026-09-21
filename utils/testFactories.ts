import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import {
  generateUUID,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "@/src/pattern/types/PatternType";

/**
 * Test factories for creating test data
 */

export function createTestPatternType(
  overrides?: Partial<PatternType>,
): PatternType {
  return {
    id: generateUUID(),
    slug: "test-type",
    color: PATTERN_TYPE_COLORS.coral,
    ...overrides,
  };
}

export function createTestPatternList(
  overrides?: Partial<IPatternList>,
): IPatternList {
  const now = Date.now();
  const defaultTypes = [
    createTestPatternType({ slug: "push", color: PATTERN_TYPE_COLORS.coral }),
    createTestPatternType({ slug: "pass", color: PATTERN_TYPE_COLORS.teal }),
  ];

  return {
    id: generateUUID(),
    name: "Test Dance",
    patternTypes: defaultTypes,
    modifiers: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestPattern(
  typeId: string,
  overrides?: Partial<IPattern>,
): IPattern {
  return {
    id: Math.floor(Math.random() * 10000),
    name: "Test Pattern",
    typeId,
    counts: 6,
    level: "beginner",
    prerequisites: [],
    description: "Test description",
    tags: [],
    videoRefs: [],
    modifierRefs: [],
    ...overrides,
  };
}

/**
 * Deterministic pseudo-random source.
 *
 * A plain LCG rather than `Math.random`, so a property test that fails does so
 * again on the next run with the same seed instead of vanishing.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export interface RandomGraphOptions {
  patternCount?: number;
  /** Chance that any given earlier pattern becomes a prerequisite. */
  edgeProbability?: number;
  /** Add ids pointing at no pattern, as older builds and bad imports do. */
  danglingCount?: number;
  /** Close some edges into cycles, which the prerequisite picker now prevents
   *  but lists written before it still contain. */
  cycleCount?: number;
}

/**
 * A random pattern graph, for properties that must hold over any input.
 *
 * Built acyclic first — a pattern may only require a lower id — then
 * deliberately corrupted, because the invariants that matter are the ones
 * that hold for the data real devices actually carry.
 */
export function createRandomPatternGraph(
  typeId: string,
  seed: number,
  options: RandomGraphOptions = {},
): IPattern[] {
  const {
    patternCount = 25,
    edgeProbability = 0.15,
    danglingCount = 0,
    cycleCount = 0,
  } = options;
  const random = seededRandom(seed);
  const patterns: IPattern[] = [];

  for (let id = 1; id <= patternCount; id++) {
    const prerequisites: number[] = [];
    for (let earlier = 1; earlier < id; earlier++) {
      if (random() < edgeProbability) prerequisites.push(earlier);
    }
    patterns.push(
      createTestPattern(typeId, { id, name: `P${id}`, prerequisites }),
    );
  }

  for (let i = 0; i < danglingCount && patterns.length > 0; i++) {
    const victim = patterns[Math.floor(random() * patterns.length)];
    victim.prerequisites.push(patternCount + 1000 + i);
  }

  for (let i = 0; i < cycleCount && patterns.length > 1; i++) {
    const low = Math.floor(random() * patterns.length);
    const high = Math.floor(random() * patterns.length);
    if (low === high) continue;
    // A back-edge from a lower id to a higher one closes a loop.
    patterns[Math.min(low, high)].prerequisites.push(
      patterns[Math.max(low, high)].id,
    );
  }

  return patterns;
}
