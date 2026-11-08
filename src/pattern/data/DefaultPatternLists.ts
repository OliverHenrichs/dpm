import {
  IModifier,
  IPattern,
  IPatternList,
  ModifierPosition,
} from "../types/IPatternList";
import type { Dance } from "../types/Dance";
import { defaultRhythm } from "@/src/pattern/rhythm/rhythm";
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
  /**
   * The figure's own rhythm, matching its counts, where the dance's basic rhythm does not fit
   * it (Standard and Latin, whose dances each count differently). Wins over `defaultRhythm`.
   */
  rhythm?: string;
  level?: string;
  description: string;
  /**
   * Names of the template patterns this one builds on: one of its own type when there is one,
   * since a Standard or Latin list has a Natural Turn or a Fan in more than one dance.
   */
  prerequisites?: string[];
  /** Names of the template's non-universal modifiers attached to this pattern. */
  modifiers?: string[];
  tags?: string[];
}

/** A modifier a template brings along, matched to its patterns by name. */
export interface TemplateModifier {
  name: string;
  position: ModifierPosition;
  universal: boolean;
  /** Translation key of what it changes; the name stays the dance's own term. */
  descriptionKey?: string;
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
 * Brazilian Zouk default pattern list
 */
export function createZoukList(): IPatternList {
  return createPatternList("Brazilian Zouk", [
    createPatternType("basic", PATTERN_TYPE_COLORS.emerald),
    createPatternType("turn", PATTERN_TYPE_COLORS.violet),
    createPatternType("elastico", PATTERN_TYPE_COLORS.amber),
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
 * Standard (ballroom) default pattern list: one type per dance, in the order competitions dance
 * them.
 */
export function createStandardList(): IPatternList {
  return createPatternList("Standard", [
    createPatternType("waltz", PATTERN_TYPE_COLORS.azure),
    createPatternType("tango", PATTERN_TYPE_COLORS.coral),
    createPatternType("viennese-waltz", PATTERN_TYPE_COLORS.violet),
    createPatternType("slow-foxtrot", PATTERN_TYPE_COLORS.amber),
    createPatternType("quickstep", PATTERN_TYPE_COLORS.emerald),
  ]);
}

/**
 * Latin default pattern list: one type per dance, in the order competitions dance them.
 */
export function createLatinList(): IPatternList {
  return createPatternList("Latin", [
    createPatternType("samba", PATTERN_TYPE_COLORS.orange),
    createPatternType("cha-cha-cha", PATTERN_TYPE_COLORS.rose),
    createPatternType("rumba", PATTERN_TYPE_COLORS.magenta),
    createPatternType("paso-doble", PATTERN_TYPE_COLORS.indigo),
    createPatternType("jive", PATTERN_TYPE_COLORS.lime),
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
 * Turn a template's modifiers into the list's own, each with a fresh id, and its description in
 * the user's language when `t` is given.
 */
export function createTemplateModifiers(
  templateModifiers: TemplateModifier[],
  t?: (key: string) => string,
): IModifier[] {
  return templateModifiers.map((tm) => ({
    id: generateUUID(),
    name: tm.name,
    position: tm.position,
    universal: tm.universal,
    videoRefs: [],
    ...(t && tm.descriptionKey && { description: t(tm.descriptionKey) }),
  }));
}

/**
 * Resolve TemplatePatterns to the patterns of a new list: ids 1…n, `typeSlug`
 * mapped to `typeId`, and prerequisites and modifiers named in the template
 * mapped to ids. Types not found in the provided list are skipped, and so is a
 * prerequisite or modifier that did not make it into the list.
 */
export function resolveTemplatePatterns(
  templatePatterns: TemplatePattern[],
  types: PatternType[],
  /** Gives each pattern its dance's basic rhythm for its counts, when there is one. */
  dance?: Dance,
  modifiers: IModifier[] = [],
): IPattern[] {
  const typed = templatePatterns.flatMap((tp) => {
    const type = types.find(
      (t) => t.slug.toLowerCase() === tp.typeSlug.toLowerCase(),
    );
    return type ? [{ tp, typeId: type.id }] : [];
  });
  // A prerequisite is looked up in the figure's own type first: Waltz and Viennese Waltz both
  // have a Natural Turn.
  const idOf = (name: string, typeId: string) => {
    const index =
      typed.findIndex((e) => e.tp.name === name && e.typeId === typeId) + 1 ||
      typed.findIndex((e) => e.tp.name === name) + 1;
    return index === 0 ? undefined : index;
  };
  return typed.map(({ tp, typeId }, i) => {
    const rhythm = tp.rhythm ?? defaultRhythm(dance, tp.counts);
    return {
      id: i + 1,
      name: tp.name,
      typeId,
      counts: tp.counts,
      level: tp.level,
      ...(rhythm && { rhythm }),
      prerequisites: (tp.prerequisites ?? []).flatMap((name) => {
        const id = idOf(name, typeId);
        return id === undefined ? [] : [id];
      }),
      description: tp.description,
      tags: tp.tags ?? [],
      videoRefs: [],
      modifierRefs: (tp.modifiers ?? []).flatMap((name) => {
        const modifier = modifiers.find((m) => m.name === name && !m.universal);
        return modifier ? [{ modifierId: modifier.id, videoRefs: [] }] : [];
      }),
    };
  });
}

/**
 * West Coast Swing modifiers, shared by the template and the example list.
 * Turns are modifiers on a base figure, not figures of their own; hesitation
 * and hand change fit any figure, so they are universal. "with Duck" follows
 * an inside turn, so it goes only on figures that take one.
 */
export const WCS_MODIFIERS: TemplateModifier[] = [
  {
    name: "with Inside Turn",
    position: "amends",
    universal: false,
    descriptionKey: "modifierDescInsideTurn",
  },
  {
    name: "with Outside Turn",
    position: "amends",
    universal: false,
    descriptionKey: "modifierDescOutsideTurn",
  },
  {
    name: "with Free Spin",
    position: "amends",
    universal: false,
    descriptionKey: "modifierDescFreeSpin",
  },
  {
    name: "with Duck",
    position: "postfix",
    universal: false,
    descriptionKey: "modifierDescDuck",
  },
  {
    name: "Hesitation",
    position: "amends",
    universal: true,
    descriptionKey: "modifierDescHesitation",
  },
  {
    name: "with Hand Change",
    position: "amends",
    universal: true,
    descriptionKey: "modifierDescHandChange",
  },
];

/** Modifiers per template id; a template not listed brings none. */
export const TEMPLATE_MODIFIERS: Record<string, TemplateModifier[]> = {
  wcs: WCS_MODIFIERS,
};

/**
 * Foundational patterns per template id
 */
export const TEMPLATE_FOUNDATIONAL_PATTERNS: Record<string, TemplatePattern[]> =
  {
    wcs: [
      {
        name: "Sugar Push",
        typeSlug: "push",
        counts: 6,
        level: "beginner",
        description: "Foundational 6-count push pattern staying in the slot.",
      },
      {
        name: "Left Side Pass",
        typeSlug: "pass",
        counts: 6,
        level: "beginner",
        description: "Foundational 6-count pass on the left side of the slot.",
        modifiers: ["with Inside Turn", "with Outside Turn", "with Duck"],
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
        name: "Sugar Tuck",
        typeSlug: "tuck",
        counts: 6,
        level: "beginner",
        description: "A sugar push whose tuck sends the follower into a turn.",
        prerequisites: ["Sugar Push"],
        modifiers: ["with Free Spin"],
      },
      {
        name: "Basic Whip",
        typeSlug: "whip",
        counts: 8,
        level: "beginner",
        description: "8-count whip — the signature WCS pattern.",
        modifiers: ["with Inside Turn", "with Outside Turn", "with Duck"],
      },
      {
        name: "Tuck Turn",
        typeSlug: "tuck",
        counts: 6,
        level: "beginner",
        description:
          "Passing tuck: a left side pass with a tuck into the follower's turn.",
        prerequisites: ["Left Side Pass"],
        modifiers: ["with Free Spin"],
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
    // The named basic patterns of traditional (Rio) Zouk, after Wikipedia ("Brazilian Zouk") and
    // Bath Zouk's move library, which also gives the viradinha as the way into lateral.
    zouk: [
      {
        name: "Basic",
        typeSlug: "basic",
        counts: 8,
        level: "beginner",
        description:
          "Passo básico: the foundational slow-quick-quick basic, danced forward and back.",
      },
      {
        name: "Viradinha",
        typeSlug: "turn",
        counts: 8,
        level: "beginner",
        description:
          'The "little turn": the follower turns half a turn into a side-by-side step.',
        prerequisites: ["Basic"],
      },
      {
        name: "Lateral",
        typeSlug: "basic",
        counts: 8,
        level: "beginner",
        description: "Side-stepping basic that travels across the floor.",
        prerequisites: ["Viradinha"],
      },
      {
        name: "Elástico",
        typeSlug: "elastico",
        counts: 8,
        level: "beginner",
        description:
          "Leader draws the follower forward by the hand, as if stretching an elastic band. Also called Raul.",
      },
      {
        name: "Bonus",
        typeSlug: "turn",
        counts: 8,
        level: "beginner",
        description:
          "Travelling follower turn of about one and a half rotations. Also called boomerang (bumerangue).",
      },
    ],
    // Standard and Latin: figures of the ISTD Bronze syllabus, named as the syllabus names them,
    // with the timings of its step charts (dancesport.uk.com syllabus lists; the step charts at
    // dance.djurredeboer.nl). Waltz, Viennese Waltz and Paso Doble are counted one step a beat;
    // Tango, Slow Foxtrot and Quickstep in slows and quicks, counted in quicks. Cha Cha Cha and
    // Rumba figures start on 2 ("2 3 4&1"), which a rhythm here cannot write (beats run from 1),
    // so they carry their counts and no rhythm.
    standard: [
      {
        name: "Closed Change",
        typeSlug: "waltz",
        counts: 3,
        rhythm: "1 2 3",
        level: "beginner",
        description:
          "One bar of three steps that changes from natural to reverse figures, or back.",
      },
      {
        name: "Natural Turn",
        typeSlug: "waltz",
        counts: 6,
        rhythm: "1 2 3 4 5 6",
        level: "beginner",
        description: "A turn to the right over two bars, counted 123 123.",
      },
      {
        name: "Reverse Turn",
        typeSlug: "waltz",
        counts: 6,
        rhythm: "1 2 3 4 5 6",
        level: "beginner",
        description: "A turn to the left over two bars, counted 123 123.",
      },
      {
        name: "Natural Spin Turn",
        typeSlug: "waltz",
        counts: 6,
        rhythm: "1 2 3 4 5 6",
        level: "beginner",
        description:
          "Steps 1–3 of the Natural Turn, then a pivot and a spin to the right.",
        prerequisites: ["Natural Turn"],
      },
      {
        name: "Whisk",
        typeSlug: "waltz",
        counts: 3,
        rhythm: "1 2 3",
        level: "beginner",
        description: "One bar that ends in promenade position.",
      },
      {
        name: "Chassé from Promenade Position",
        typeSlug: "waltz",
        counts: 3,
        rhythm: "1 2&3",
        level: "beginner",
        description: "A chassé from promenade position, counted 1 2&3.",
        prerequisites: ["Whisk"],
      },
      {
        name: "Walk",
        typeSlug: "tango",
        counts: 2,
        rhythm: "S",
        level: "beginner",
        description: "One walking step, forward or back, on a slow.",
      },
      {
        name: "Progressive Side Step",
        typeSlug: "tango",
        counts: 4,
        rhythm: "Q Q S",
        level: "beginner",
        description: "Three steps that travel forward: quick, quick, slow.",
      },
      {
        name: "Progressive Link",
        typeSlug: "tango",
        counts: 2,
        rhythm: "Q Q",
        level: "beginner",
        description: "Two quicks that turn the couple into promenade position.",
      },
      {
        name: "Closed Promenade",
        typeSlug: "tango",
        counts: 6,
        rhythm: "S Q Q S",
        level: "beginner",
        description:
          "Travels in promenade position and ends in closed position: slow, quick, quick, slow.",
        prerequisites: ["Progressive Link"],
      },
      {
        name: "Natural Turn",
        typeSlug: "viennese-waltz",
        counts: 6,
        rhythm: "1 2 3 4 5 6",
        level: "beginner",
        description: "A continuous turn to the right, six steps over two bars.",
      },
      {
        name: "Reverse Turn",
        typeSlug: "viennese-waltz",
        counts: 6,
        rhythm: "1 2 3 4 5 6",
        level: "beginner",
        description: "A continuous turn to the left, six steps over two bars.",
      },
      {
        name: "RF Forward Change Step Natural to Reverse",
        typeSlug: "viennese-waltz",
        counts: 3,
        rhythm: "1 2 3",
        level: "beginner",
        description:
          "One bar, starting with the right foot forward, that links the Natural Turn to the Reverse Turn.",
        prerequisites: ["Natural Turn", "Reverse Turn"],
      },
      {
        name: "LF Forward Change Step Reverse to Natural",
        typeSlug: "viennese-waltz",
        counts: 3,
        rhythm: "1 2 3",
        level: "beginner",
        description:
          "One bar, starting with the left foot forward, that links the Reverse Turn to the Natural Turn.",
        prerequisites: ["Natural Turn", "Reverse Turn"],
      },
      {
        name: "Feather Step",
        typeSlug: "slow-foxtrot",
        counts: 4,
        rhythm: "S Q Q",
        level: "beginner",
        description:
          "Slow, quick, quick, ending with the man stepping outside his partner.",
      },
      {
        name: "Three Step",
        typeSlug: "slow-foxtrot",
        counts: 4,
        rhythm: "S Q Q",
        level: "beginner",
        description: "Three steps forward: slow, quick, quick.",
      },
      {
        name: "Natural Turn",
        typeSlug: "slow-foxtrot",
        counts: 10,
        rhythm: "S Q Q S S S",
        level: "beginner",
        description:
          "A turn to the right: slow, quick, quick, slow, slow, slow.",
      },
      {
        name: "Reverse Turn (incorporating Feather Finish)",
        typeSlug: "slow-foxtrot",
        counts: 8,
        rhythm: "S Q Q S Q Q",
        level: "beginner",
        description:
          "A turn to the left that ends with a feather finish: slow, quick, quick, slow, quick, quick.",
      },
      {
        name: "Quarter Turn to Right",
        typeSlug: "quickstep",
        counts: 6,
        rhythm: "S Q Q S",
        level: "beginner",
        description:
          "A quarter turn to the right with a chassé: slow, quick, quick, slow.",
      },
      {
        name: "Progressive Chassé",
        typeSlug: "quickstep",
        counts: 6,
        rhythm: "S Q Q S",
        level: "beginner",
        description: "A chassé: slow, quick, quick, slow.",
      },
      {
        name: "Forward Lock",
        typeSlug: "quickstep",
        counts: 6,
        rhythm: "S Q Q S",
        level: "beginner",
        description:
          "Travels forward with the back foot crossing behind on the second quick: slow, quick, quick, slow.",
      },
      {
        name: "Natural Spin Turn",
        typeSlug: "quickstep",
        counts: 10,
        rhythm: "S Q Q S S S",
        level: "beginner",
        description:
          "A natural turn that ends in a pivot and a spin to the right: slow, quick, quick, slow, slow, slow.",
      },
    ],
    latin: [
      {
        name: "Natural Basic Movement",
        typeSlug: "samba",
        counts: 4,
        rhythm: "1a2 3a4",
        level: "beginner",
        description:
          "The basic, forward and back, with the samba bounce: counted 1 a 2, 1 a 2.",
      },
      {
        name: "Reverse Basic Movement",
        typeSlug: "samba",
        counts: 4,
        rhythm: "1a2 3a4",
        level: "beginner",
        description:
          "The basic starting with the left foot forward; it may turn to the left. Counted 1 a 2, 1 a 2.",
      },
      {
        name: "Whisks",
        typeSlug: "samba",
        counts: 4,
        rhythm: "1a2 3a4",
        level: "beginner",
        description:
          "A whisk to the left and one to the right, the foot crossing behind: 1 a 2, 1 a 2.",
      },
      {
        name: "Closed Basic",
        typeSlug: "cha-cha-cha",
        counts: 8,
        level: "beginner",
        description:
          "The basic in closed hold over two bars, counted 2 3 4&1, with a chassé on 4&1.",
      },
      {
        name: "New York",
        typeSlug: "cha-cha-cha",
        counts: 4,
        level: "beginner",
        description:
          "A check forward in side-by-side position, to the left or right; one bar, counted 2 3 4&1.",
      },
      {
        name: "Fan",
        typeSlug: "cha-cha-cha",
        counts: 8,
        level: "beginner",
        description:
          "Opens the lady out to the man's left into fan position, at right angles to him.",
      },
      {
        name: "Hockey Stick",
        typeSlug: "cha-cha-cha",
        counts: 8,
        level: "beginner",
        description:
          "From fan position, the lady turns to the left under the raised arm.",
        prerequisites: ["Fan"],
      },
      {
        name: "Alemana",
        typeSlug: "cha-cha-cha",
        counts: 8,
        level: "beginner",
        description:
          "From fan position, the lady turns to the right under the raised arm.",
        prerequisites: ["Fan"],
      },
      {
        name: "Closed Basic",
        typeSlug: "rumba",
        counts: 8,
        level: "beginner",
        description:
          "The basic in closed hold over two bars, counted 2 3 4-1, the step on 4 held through 1.",
      },
      {
        name: "Fan",
        typeSlug: "rumba",
        counts: 8,
        level: "beginner",
        description:
          "Opens the lady out to the man's left into fan position, at right angles to him.",
      },
      {
        name: "Hockey Stick",
        typeSlug: "rumba",
        counts: 8,
        level: "beginner",
        description:
          "From fan position, the lady turns to the left under the raised arm.",
        prerequisites: ["Fan"],
      },
      {
        name: "Alemana",
        typeSlug: "rumba",
        counts: 8,
        level: "beginner",
        description:
          "From fan position, the lady turns to the right under the raised arm.",
        prerequisites: ["Fan"],
      },
      {
        name: "Sur Place",
        typeSlug: "paso-doble",
        counts: 4,
        rhythm: "1 2 3 4",
        level: "beginner",
        description: "Marching on the spot, one step a beat.",
      },
      {
        name: "Basic Movement",
        typeSlug: "paso-doble",
        counts: 4,
        rhythm: "1 2 3 4",
        level: "beginner",
        description: "Marching steps forward or back, one step a beat.",
      },
      {
        name: "Chassés to Right or Left",
        typeSlug: "paso-doble",
        counts: 4,
        rhythm: "1 2 3 4",
        level: "beginner",
        description:
          "Chassés travelling to the man's right or left, one step a beat.",
      },
      {
        name: "Separation",
        typeSlug: "paso-doble",
        counts: 8,
        rhythm: "1 2 3 4 5 6 7 8",
        level: "beginner",
        description:
          "Begins with the man's appel; the couple move apart and come back together.",
      },
      {
        name: "Huit",
        typeSlug: "paso-doble",
        counts: 8,
        rhythm: "1 2 3 4 5 6 7 8",
        level: "beginner",
        description:
          "The cape figure: the man leads the lady from side to side in front of him.",
      },
      {
        name: "Basic in Place",
        typeSlug: "jive",
        counts: 6,
        rhythm: "1 2 3a4 5a6",
        level: "beginner",
        description: "A rock and two chassés in place, counted 1 2 3a4 3a4.",
      },
      {
        name: "Fallaway Rock",
        typeSlug: "jive",
        counts: 6,
        rhythm: "1 2 3a4 5a6",
        level: "beginner",
        description:
          "A rock back in fallaway position and two chassés, counted 1 2 3a4 3a4.",
      },
      {
        name: "Change of Places Right to Left",
        typeSlug: "jive",
        counts: 6,
        rhythm: "1 2 3a4 5a6",
        level: "beginner",
        description:
          "The lady turns to the right under the man's left arm as the couple change places.",
      },
      {
        name: "Change of Places Left to Right",
        typeSlug: "jive",
        counts: 6,
        rhythm: "1 2 3a4 5a6",
        level: "beginner",
        description:
          "The lady turns to the left under the man's left arm as the couple change places back.",
        prerequisites: ["Change of Places Right to Left"],
      },
      {
        name: "American Spin",
        typeSlug: "jive",
        counts: 6,
        rhythm: "1 2 3a4 5a6",
        level: "beginner",
        description:
          "From a right-to-right hand hold, the lady spins to the right.",
      },
    ],
  };
