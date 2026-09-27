import { IPatternList, IPattern } from "@/src/pattern/types/IPatternList";

/** whisper.cpp keeps the prompt short; past this the oldest words would be cut anyway. */
const MAX_PROMPT_CHARS = 600;

/**
 * Whisper's initial prompt, made from the list's own words — pattern names, type slugs, modifier
 * names and tags — so decoding leans toward "sugar push" rather than "sugar bush". Teachers say
 * these words; a general model has rarely heard them.
 */
export function vocabularyPrompt(
  list: IPatternList,
  patterns: IPattern[],
): string {
  const words = [
    ...patterns.map((p) => p.name),
    ...list.patternTypes.map((t) => t.slug),
    ...(list.modifiers ?? []).map((m) => m.name),
    ...patterns.flatMap((p) => p.tags),
  ]
    .map((w) => w.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }

  let prompt = "";
  for (const word of unique) {
    const next = prompt ? `${prompt}, ${word}` : word;
    if (next.length > MAX_PROMPT_CHARS) break;
    prompt = next;
  }
  return prompt ? `${prompt}.` : "";
}
