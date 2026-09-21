import {
  generateUUID,
  isSlugUnique,
  normalizeSlug,
} from "@/src/pattern/types/PatternType";
import { createTestPatternType } from "@/utils/testFactories";

describe("PatternType utilities", () => {
  describe("normalizeSlug", () => {
    it("should convert to lowercase", () => {
      expect(normalizeSlug("PUSH")).toBe("push");
      expect(normalizeSlug("Cross Body Lead")).toBe("cross-body-lead");
    });

    it("should replace spaces with hyphens", () => {
      expect(normalizeSlug("cross body lead")).toBe("cross-body-lead");
      expect(normalizeSlug("right side pass")).toBe("right-side-pass");
    });

    it("should remove special characters", () => {
      expect(normalizeSlug("push!@#")).toBe("push");
      expect(normalizeSlug("turn_180°")).toBe("turn180");
    });

    it("should handle multiple spaces", () => {
      expect(normalizeSlug("cross  body   lead")).toBe("cross-body-lead");
    });

    it("should trim whitespace", () => {
      expect(normalizeSlug("  push  ")).toBe("push");
    });
  });

  describe("isSlugUnique", () => {
    it("should return true for unique slug", () => {
      const types = [
        createTestPatternType({ slug: "push" }),
        createTestPatternType({ slug: "pass" }),
      ];

      expect(isSlugUnique("whip", types)).toBe(true);
    });

    it("should return false for duplicate slug", () => {
      const types = [
        createTestPatternType({ slug: "push" }),
        createTestPatternType({ slug: "pass" }),
      ];

      expect(isSlugUnique("push", types)).toBe(false);
    });

    it("should be case-insensitive", () => {
      const types = [createTestPatternType({ slug: "push" })];

      expect(isSlugUnique("PUSH", types)).toBe(false);
      expect(isSlugUnique("Push", types)).toBe(false);
    });

    it("should normalize before comparing", () => {
      const types = [createTestPatternType({ slug: "cross-body-lead" })];

      expect(isSlugUnique("Cross Body Lead", types)).toBe(false);
    });

    it("should exclude specific ID when checking", () => {
      const type1 = createTestPatternType({ id: "id1", slug: "push" });
      const types = [type1];

      // Same slug but same ID should be considered unique (editing same type)
      expect(isSlugUnique("push", types, "id1")).toBe(true);
      expect(isSlugUnique("push", types, "id2")).toBe(false);
    });
  });

  describe("generateUUID", () => {
    it("should generate valid UUID v4 format", () => {
      const uuid = generateUUID();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidRegex);
    });

    it("should generate unique UUIDs", () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      const uuid3 = generateUUID();

      expect(uuid1).not.toBe(uuid2);
      expect(uuid2).not.toBe(uuid3);
      expect(uuid1).not.toBe(uuid3);
    });

    it("should always have 4 in the third section", () => {
      // UUID v4 always has 4 in the version position
      for (let i = 0; i < 10; i++) {
        const uuid = generateUUID();
        const sections = uuid.split("-");
        expect(sections[2][0]).toBe("4");
      }
    });
  });
});
