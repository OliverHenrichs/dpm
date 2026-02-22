import {
  Pattern,
  PatternList,
  VideoReference,
} from "@/components/pattern/types/PatternList";
import {
  generateUUID,
  PATTERN_TYPE_COLORS,
  PatternType,
} from "@/components/pattern/types/PatternType";

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
  overrides?: Partial<PatternList>,
): PatternList {
  const now = Date.now();
  const defaultTypes = [
    createTestPatternType({ slug: "push", color: PATTERN_TYPE_COLORS.coral }),
    createTestPatternType({ slug: "pass", color: PATTERN_TYPE_COLORS.teal }),
  ];

  return {
    id: generateUUID(),
    name: "Test Dance",
    patternTypes: defaultTypes,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestPattern(
  typeId: string,
  overrides?: Partial<Pattern>,
): Pattern {
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
    ...overrides,
  };
}

export function createTestVideoReference(
  overrides?: Partial<VideoReference>,
): VideoReference {
  return {
    type: "url",
    value: "https://example.com/video.mp4",
    ...overrides,
  };
}

/**
 * Create a pattern list with patterns for testing
 */
export function createTestPatternListWithPatterns(patternCount: number = 3): {
  list: PatternList;
  patterns: Pattern[];
} {
  const list = createTestPatternList();
  const patterns: Pattern[] = [];

  for (let i = 0; i < patternCount; i++) {
    const typeIndex = i % list.patternTypes.length;
    patterns.push(
      createTestPattern(list.patternTypes[typeIndex].id, {
        id: i,
        name: `Pattern ${i}`,
      }),
    );
  }

  return { list, patterns };
}
