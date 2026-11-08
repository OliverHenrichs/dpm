/**
 * The dance a list is for. Optional: it gives a template's patterns their basic rhythm
 * (`src/pattern/rhythm/`) and transcription its glossary, so a list without one still works.
 * A template sets it; the list's settings change it.
 *
 * Standard and Latin are each a group of five dances, as dance schools and competitions teach
 * them: a list for one holds a type per dance, and each figure carries its own rhythm.
 */
export const DANCES = [
  "wcs",
  "lindy",
  "salsa",
  "bachata",
  "tango",
  "zouk",
  "standard",
  "latin",
] as const;

export type Dance = (typeof DANCES)[number];

export function isDance(value: unknown): value is Dance {
  return (DANCES as readonly unknown[]).includes(value);
}

/** i18n keys of the dances' names. */
export const DANCE_NAME_KEYS: Record<Dance, string> = {
  wcs: "templateWcsName",
  lindy: "templateLindyName",
  salsa: "templateSalsaName",
  bachata: "templateBachataName",
  tango: "templateTangoName",
  zouk: "templateZoukName",
  standard: "templateStandardName",
  latin: "templateLatinName",
};
