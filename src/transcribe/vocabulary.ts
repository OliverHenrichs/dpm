import { IPatternList, IPattern } from "@/src/pattern/types/IPatternList";
import { DANCE_GLOSSARY } from "@/src/transcribe/glossary";

/**
 * Short on purpose: whisper.cpp spends decoder context on the prompt, and the L4 spike found a
 * long one slows and merges segments. The words most likely said come first, so they are what
 * survives the cut.
 */
const MAX_PROMPT_CHARS = 224;

/** The pattern whose video is being transcribed, as far as it is known. */
export type VocabularyFocus = {
  /** Its name in the form; a new pattern is not in the list yet. */
  name: string;
  /** The stored pattern, when the video belongs to one. */
  pattern?: IPattern;
};

/**
 * The words a teacher is likely to say, most likely first: the pattern in the video, its
 * modifiers and prerequisites; then the rest of the list's pattern names; the dance's standard
 * terms (`glossary.ts`); and the list's types, modifiers and tags. Teachers say these words; a
 * general model has rarely heard them, so it writes "sugar bush" for "sugar push".
 *
 * The video's own pattern goes first because the prompt is cut: in list order, a long list's
 * last patterns never made it in, whichever one the video showed.
 */
export function vocabularyTerms(
  list: IPatternList,
  patterns: IPattern[],
  focus?: VocabularyFocus,
): string[] {
  const modifiers = list.modifiers ?? [];
  const pattern = focus?.pattern;
  const focusTerms = [
    focus?.name ?? "",
    ...(pattern?.modifierRefs ?? []).map(
      (ref) => modifiers.find((m) => m.id === ref.modifierId)?.name ?? "",
    ),
    ...(pattern?.prerequisites ?? []).map(
      (id) => patterns.find((p) => p.id === id)?.name ?? "",
    ),
  ];
  return unique([
    ...focusTerms,
    ...patterns.map((p) => p.name),
    ...(list.dance ? DANCE_GLOSSARY[list.dance] : []),
    ...list.patternTypes.map((t) => t.slug),
    ...modifiers.map((m) => m.name),
    ...patterns.flatMap((p) => p.tags),
  ]);
}

/**
 * Whisper's initial prompt from terms, most important first: as many whole terms as fit in
 * MAX_PROMPT_CHARS, each once whatever its case.
 */
export function promptFromTerms(terms: string[]): string {
  let prompt = "";
  for (const term of unique(terms)) {
    const next = prompt ? `${prompt}, ${term}` : term;
    if (next.length > MAX_PROMPT_CHARS) break;
    prompt = next;
  }
  return prompt ? `${prompt}.` : "";
}

/** The list's words as Whisper's prompt; see vocabularyTerms. */
export function vocabularyPrompt(
  list: IPatternList,
  patterns: IPattern[],
  focus?: VocabularyFocus,
): string {
  return promptFromTerms(vocabularyTerms(list, patterns, focus));
}

/**
 * The pattern a video belongs to: the one carrying it, on itself or on one of its modifiers.
 * A video added in an unsaved form is on no stored pattern yet.
 */
export function patternWithVideo(
  patterns: IPattern[],
  videoUri: string,
): IPattern | undefined {
  return patterns.find(
    (p) =>
      p.videoRefs.some((v) => v.value === videoUri) ||
      p.modifierRefs.some((ref) =>
        ref.videoRefs.some((v) => v.value === videoUri),
      ),
  );
}

function unique(words: string[]): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const word of words.map((w) => w.trim()).filter(Boolean)) {
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(word);
  }
  return kept;
}
