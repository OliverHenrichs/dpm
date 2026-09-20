import { generateEdges } from "@/src/pattern/graph/utils/GraphUtils";
import { PatternLevel } from "@/src/pattern/types/PatternLevel";
import { IPattern } from "@/src/pattern/types/IPatternList";
import {
  calculatePrerequisiteDepthMap,
  detectCircularDependencies,
} from "@/src/pattern/graph/utils/GenericGraphUtils";

function createTestWCSPattern(overrides?: Partial<IPattern>): IPattern {
  return {
    id: Math.floor(Math.random() * 10000),
    name: "Test Pattern",
    counts: 6,
    typeId: "TestType",
    level: PatternLevel.BEGINNER,
    prerequisites: [],
    description: "Test description",
    tags: [],
    videoRefs: [],
    modifierRefs: [],
    ...overrides,
  };
}

describe("GraphUtils", () => {
  describe("generateEdges", () => {
    it("should generate edges from pattern prerequisites", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [1] }),
        createTestWCSPattern({ id: 3, prerequisites: [1, 2] }),
      ];

      const edges = generateEdges(patterns);

      expect(edges).toHaveLength(3);
      expect(edges).toContainEqual({ from: 1, to: 2 });
      expect(edges).toContainEqual({ from: 1, to: 3 });
      expect(edges).toContainEqual({ from: 2, to: 3 });
    });

    it("should return empty array for patterns with no prerequisites", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [] }),
      ];

      const edges = generateEdges(patterns);

      expect(edges).toHaveLength(0);
    });
  });

  describe("detectCircularDependencies", () => {
    it("should detect simple circular dependency", () => {
      // Create a circular reference (this shouldn't happen in practice, but we test it)
      const pattern1 = createTestWCSPattern({
        id: 1,
        prerequisites: [2],
      });
      const pattern2 = createTestWCSPattern({
        id: 2,
        prerequisites: [1],
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const cycles = detectCircularDependencies([pattern1, pattern2]);

      expect(cycles.length).toBeGreaterThan(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should return empty array for acyclic graph", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [1] }),
        createTestWCSPattern({ id: 3, prerequisites: [2] }),
      ];

      const cycles = detectCircularDependencies(patterns);

      expect(cycles).toHaveLength(0);
    });
  });

  describe("calculatePrerequisiteDepthMap", () => {
    it("should calculate depth 0 for foundational patterns", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [] }),
      ];

      const depthMap = calculatePrerequisiteDepthMap(patterns);

      expect(depthMap.get(1)).toBe(0);
      expect(depthMap.get(2)).toBe(0);
    });

    it("should calculate depth 1 for patterns with foundational prerequisites", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [1] }),
      ];

      const depthMap = calculatePrerequisiteDepthMap(patterns);

      expect(depthMap.get(1)).toBe(0);
      expect(depthMap.get(2)).toBe(1);
    });

    it("should calculate correct depth for multi-level prerequisites", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [1] }),
        createTestWCSPattern({ id: 3, prerequisites: [2] }),
        createTestWCSPattern({ id: 4, prerequisites: [1, 3] }),
      ];

      const depthMap = calculatePrerequisiteDepthMap(patterns);

      expect(depthMap.get(1)).toBe(0);
      expect(depthMap.get(2)).toBe(1);
      expect(depthMap.get(3)).toBe(2);
      expect(depthMap.get(4)).toBe(3); // Max of prerequisites (1=0, 3=2) + 1
    });

    it("should handle multiple prerequisite paths to same depth", () => {
      const patterns = [
        createTestWCSPattern({ id: 1, prerequisites: [] }),
        createTestWCSPattern({ id: 2, prerequisites: [] }),
        createTestWCSPattern({ id: 3, prerequisites: [1, 2] }),
      ];

      const depthMap = calculatePrerequisiteDepthMap(patterns);

      expect(depthMap.get(3)).toBe(1);
    });

    it("should handle circular dependencies gracefully", () => {
      const pattern1 = createTestWCSPattern({
        id: 1,
        prerequisites: [2],
      });
      const pattern2 = createTestWCSPattern({
        id: 2,
        prerequisites: [1],
      });

      // Should not throw, will calculate depths based on order
      const depthMap = calculatePrerequisiteDepthMap([pattern1, pattern2]);

      expect(depthMap.size).toBe(2);
      // Due to processing order, one pattern will be treated as foundational
      expect(depthMap.get(1)).toBeGreaterThanOrEqual(0);
      expect(depthMap.get(2)).toBeGreaterThanOrEqual(0);
    });
  });
});
