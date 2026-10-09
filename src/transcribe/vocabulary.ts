import { IPatternList, IPattern } from "@/src/pattern/types/IPatternList";
import { glossaryTerms } from "@/src/transcribe/glossary";

/**
 * How much of Whisper's prompt the list's words may take, in estimated tokens (`estimateTokens`).
 * whisper.cpp reads at most 223 prompt tokens and shares them with the text it has just decoded;
 * past that it drops the prompt's *start*. This leaves room for that context. (The L4 spike's
 * slow, merged decoding with a long prompt was on music, which voice detection now skips, and
 * long lines are split afterwards.)
 */
const MAX_PROMPT_TOKENS = 150;

/** The pattern whose video is being transcribed, as far as it is known. */
export type VocabularyOptions = {
  /** Its name in the form; a new pattern is not in the list yet. */
  name?: string;
  /** The stored pattern, when the video belongs to one. */
  pattern?: IPattern;
  /** ISO 639-1, picking the glossary's spellings: chosen, or the list's usual one. */
  language?: string;
};

/**
 * The words a teacher is likely to say, most likely first: the pattern in the video, its
 * modifiers and prerequisites; then the rest of the list's pattern names; the dance's standard
 * terms (`glossary/`, in the language's spelling); and the list's types, modifiers and tags. Teachers say these words; a
 * general model has rarely heard them, so it writes "sugar bush" for "sugar push".
 *
 * The video's own pattern goes first because the prompt is cut: in list order, a long list's
 * last patterns never made it in, whichever one the video showed.
 */
export function vocabularyTerms(
  list: IPatternList,
  patterns: IPattern[],
  focus: VocabularyOptions = {},
): string[] {
  const modifiers = list.modifiers ?? [];
  const pattern = focus.pattern;
  const focusTerms = [
    focus.name ?? "",
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
    ...(list.dance ? glossaryTerms(list.dance, focus.language) : []),
    ...list.patternTypes.map((t) => t.slug),
    ...modifiers.map((m) => m.name),
    ...patterns.flatMap((p) => p.tags),
  ]);
}

/**
 * Whisper's initial prompt from terms, given most important first: as many whole terms as fit
 * in MAX_PROMPT_TOKENS, each once whatever its case, written **most important last**. The end
 * of the prompt sits next to what Whisper decodes, and is the part whisper.cpp keeps when
 * context runs short.
 */
export function promptFromTerms(terms: string[]): string {
  const kept: string[] = [];
  let tokens = 0;
  for (const term of unique(terms)) {
    const cost = estimateTokens(term) + 1; // and the comma
    if (tokens + cost > MAX_PROMPT_TOKENS) break;
    kept.push(term);
    tokens += cost;
  }
  return kept.length ? `${kept.reverse().join(", ")}.` : "";
}

/**
 * Whisper's tokens for a text, estimated on the safe side: English-like text is about four
 * characters a token, so three is generous; other scripts can take a token or more per
 * character.
 */
export function estimateTokens(text: string): number {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if (char.charCodeAt(0) < 128) ascii++;
    else other++;
  }
  return Math.ceil(ascii / 3) + 2 * other;
}

/** The list's words as Whisper's prompt; see vocabularyTerms. */
export function vocabularyPrompt(
  list: IPatternList,
  patterns: IPattern[],
  focus?: VocabularyOptions,
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

/**
 * The language most of the list's transcripts are in, for spelling the glossary's terms before
 * Whisper has heard this video. Undefined when none has a language yet.
 */
export function usualTranscriptLanguage(
  patterns: IPattern[],
): string | undefined {
  const counts = new Map<string, number>();
  for (const p of patterns) {
    const refs = [
      ...p.videoRefs,
      ...p.modifierRefs.flatMap((m) => m.videoRefs),
    ];
    for (const ref of refs) {
      const language = ref.transcript?.language;
      if (!language || language === "und") continue;
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  for (const [language, n] of counts) {
    if (!best || n > counts.get(best)!) best = language;
  }
  return best;
}
