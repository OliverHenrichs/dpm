import { Dance } from "@/src/pattern/types/Dance";

/**
 * Standard terms of each dance, for Whisper's prompt when the list itself does not name them
 * yet: a new list has few patterns, and a teacher says "anchor step" whatever the list holds.
 * Spelling is what matters here, so these are the spellings teachers and festivals use. Keep
 * them to established terms (check before adding one); a wrong word in the prompt is a wrong
 * word Whisper leans toward.
 */
export const DANCE_GLOSSARY: Record<Dance, readonly string[]> = {
  wcs: [
    "anchor step",
    "sugar push",
    "left side pass",
    "underarm turn",
    "whip",
    "tuck turn",
    "slot",
    "triple step",
    "starter step",
    "lead",
    "follow",
    "connection",
    "compression",
  ],
  lindy: [
    "swing out",
    "lindy circle",
    "tuck turn",
    "Texas Tommy",
    "Charleston",
    "rock step",
    "triple step",
    "lead",
    "follow",
  ],
  salsa: [
    "cross body lead",
    "dile que no",
    "enchufla",
    "setenta",
    "copa",
    "inside turn",
    "outside turn",
    "shine",
    "on1",
    "on2",
  ],
  bachata: [
    "basic step",
    "side basic",
    "box step",
    "tap",
    "body roll",
    "hip roll",
    "inside turn",
    "outside turn",
    "cross body lead",
  ],
  tango: [
    "abrazo",
    "salida",
    "ocho",
    "ocho cortado",
    "giro",
    "molinete",
    "sacada",
    "boleo",
    "gancho",
    "parada",
    "barrida",
    "cruzada",
  ],
};
