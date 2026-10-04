/**
 * The dance a list is for. Optional: it only picks which rhythms are suggested for a pattern's
 * counts (`src/pattern/rhythm/`), so a list without one still works, with plain suggestions.
 * A template sets it; the list's settings change it.
 */
export const DANCES = ["wcs", "lindy", "salsa", "bachata", "tango"] as const;

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
};
