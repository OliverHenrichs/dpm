import { Dance } from "@/src/pattern/types/Dance";
import bachata from "@/src/transcribe/glossary/bachata.json";
import lindy from "@/src/transcribe/glossary/lindy.json";
import salsa from "@/src/transcribe/glossary/salsa.json";
import tango from "@/src/transcribe/glossary/tango.json";
import wcs from "@/src/transcribe/glossary/wcs.json";

/**
 * One term of a dance: a spelling said in every language, or an object with the spelling to
 * use by default (`term`) and, keyed by ISO 639-1 code, the spelling teachers use in that
 * language where it differs. See README.md in this folder.
 */
export type GlossaryEntry =
  string | ({ term: string } & Record<string, string>);

export type Glossary = { terms: GlossaryEntry[] };

/**
 * Standard terms of each dance, for Whisper's prompt (`vocabulary.ts`), most common first: only
 * as many as fit go in. The files are data, so the glossary grows without touching code.
 */
export const DANCE_GLOSSARIES: Record<Dance, Glossary> = {
  wcs,
  lindy,
  salsa,
  bachata,
  tango,
};

/** A dance's terms, spelt for [language] where the glossary knows a spelling for it. */
export function glossaryTerms(dance: Dance, language?: string): string[] {
  return DANCE_GLOSSARIES[dance].terms.map((entry) => spell(entry, language));
}

/** One entry's spelling for [language], else its default. */
export function spell(entry: GlossaryEntry, language?: string): string {
  if (typeof entry === "string") return entry;
  return (language && entry[language]) || entry.term;
}
