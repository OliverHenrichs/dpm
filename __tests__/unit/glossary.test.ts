import { DANCES } from "@/src/pattern/types/Dance";
import {
  DANCE_GLOSSARIES,
  glossaryTerms,
  spell,
} from "@/src/transcribe/glossary";

describe("dance glossaries", () => {
  it.each(DANCES)(
    "%s: every term is a non-empty spelling, said once",
    (dance) => {
      const seen = new Set<string>();
      for (const entry of DANCE_GLOSSARIES[dance].terms) {
        const spellings =
          typeof entry === "string" ? [entry] : Object.values(entry);
        if (typeof entry !== "string") {
          expect(typeof entry.term).toBe("string");
          for (const key of Object.keys(entry)) {
            expect(key === "term" || /^[a-z]{2}$/.test(key)).toBe(true);
          }
        }
        for (const spelling of spellings) {
          expect(typeof spelling).toBe("string");
          expect(spelling.trim()).toBe(spelling);
          expect(spelling).not.toBe("");
        }
        const key = (
          typeof entry === "string" ? entry : entry.term
        ).toLowerCase();
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    },
  );

  it("uses a language's spelling where there is one, else the term", () => {
    const entry = { term: "underarm turn", xx: "test spelling" };

    expect(spell(entry, "xx")).toBe("test spelling");
    expect(spell(entry, "de")).toBe("underarm turn");
    expect(spell(entry)).toBe("underarm turn");
    expect(spell("anchor step", "xx")).toBe("anchor step");
    expect(glossaryTerms("wcs")[0]).toBe("anchor step");
  });
});
