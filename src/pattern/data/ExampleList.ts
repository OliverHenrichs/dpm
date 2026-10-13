import {
  createPatternList,
  createPatternType,
  createTemplateModifiers,
  resolveTemplatePatterns,
  TemplatePattern,
  WCS_MODIFIERS,
} from "./DefaultPatternLists";
import { PATTERN_TYPE_COLORS } from "../types/PatternType";
import { PatternListWithPatterns } from "./types/IExportData";

/**
 * The example list a new user can open from the empty Lists screen: a West
 * Coast Swing group's list after two beginner courses and a festival, so the
 * Map shows a real tree and the modifiers and tags have something to do.
 *
 * Figure and modifier names are the dance's own terms and stay in English, as
 * in the templates; the list's name, the descriptions and the tags are
 * translated. It carries no videos, since every video is the user's own.
 */
export function createExampleList(
  t: (key: string) => string,
): PatternListWithPatterns {
  const beginners1 = t("exampleTagBeginners1");
  const beginners2 = t("exampleTagBeginners2");
  const festival = t("exampleTagFestival");
  const figures: TemplatePattern[] = [
    {
      name: "Sugar Push",
      typeSlug: "push",
      counts: 6,
      level: "beginner",
      description: t("exampleDescSugarPush"),
      tags: [beginners1],
    },
    {
      name: "Left Side Pass",
      typeSlug: "pass",
      counts: 6,
      level: "beginner",
      description: t("exampleDescLeftSidePass"),
      tags: [beginners1],
      modifiers: ["with Inside Turn", "with Outside Turn", "with Duck"],
    },
    {
      name: "Underarm Turn",
      typeSlug: "pass",
      counts: 6,
      level: "beginner",
      description: t("exampleDescUnderarmTurn"),
      tags: [beginners1],
    },
    {
      name: "Sugar Tuck",
      typeSlug: "tuck",
      counts: 6,
      level: "beginner",
      description: t("exampleDescSugarTuck"),
      tags: [beginners1],
      prerequisites: ["Sugar Push"],
      modifiers: ["with Free Spin"],
    },
    {
      name: "Basic Whip",
      typeSlug: "whip",
      counts: 8,
      level: "beginner",
      description: t("exampleDescBasicWhip"),
      tags: [beginners1],
      modifiers: ["with Inside Turn", "with Outside Turn", "with Duck"],
    },
    {
      name: "Tuck Turn",
      typeSlug: "tuck",
      counts: 6,
      level: "beginner",
      description: t("exampleDescTuckTurn"),
      tags: [beginners2],
      prerequisites: ["Left Side Pass"],
      modifiers: ["with Free Spin"],
    },
    {
      name: "Basket Whip",
      typeSlug: "whip",
      counts: 8,
      level: "intermediate",
      description: t("exampleDescBasketWhip"),
      tags: [beginners2],
      prerequisites: ["Basic Whip"],
    },
    {
      name: "Behind-the-Back Whip",
      typeSlug: "whip",
      counts: 8,
      level: "intermediate",
      description: t("exampleDescBehindTheBackWhip"),
      tags: [festival],
      prerequisites: ["Basic Whip"],
    },
  ];

  const types = [
    createPatternType("push", PATTERN_TYPE_COLORS.coral),
    createPatternType("pass", PATTERN_TYPE_COLORS.teal),
    createPatternType("whip", PATTERN_TYPE_COLORS.violet),
    createPatternType("tuck", PATTERN_TYPE_COLORS.amber),
  ];
  const modifiers = createTemplateModifiers(WCS_MODIFIERS);
  const patterns = resolveTemplatePatterns(figures, types, "wcs", modifiers);
  return {
    ...createPatternList(t("exampleListName"), types),
    modifiers,
    dance: "wcs",
    patterns,
  };
}
