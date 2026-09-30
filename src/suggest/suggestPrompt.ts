import { IPattern, IPatternList } from "@/src/pattern/types/IPatternList";
import { LANGUAGES } from "@/src/settings/types/Languages";

/**
 * What the suggestion model is asked, and how its answer is read (L4 suggestions,
 * AGENT_TASKS.md). Kept pure so the prompt can be changed and tested apart from the engine.
 *
 * The prompt is the spike's v2. v1 asked for a name and a description only, and the models
 * invented a pattern for a water break, primed by the list's vocabulary; v2 has them say first
 * whether anything is taught at all, and allows the vocabulary for spelling only.
 */
export type Suggestion = { name: string; description: string };

// `teaches` comes first, so the model commits to whether there is a pattern before it names one.
export const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    teaches: { type: "boolean" },
    name: { type: "string" },
    description: { type: "string" },
  },
  required: ["teaches", "name", "description"],
} as const;

const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.englishName]),
);

export function languageName(code: string): string | undefined {
  return LANGUAGE_NAMES[code];
}

const SYSTEM = `You help dancers keep notes on partner-dance patterns.
You get a transcript of a video, made automatically (it may contain recognition mistakes), and the dancer's vocabulary of pattern names and terms.
Answer with JSON:
- "teaches": true only if the speaker explains how to dance a pattern: steps, counts, or what the lead or follow does. Chat, breaks, tests and introductions are false.
- "name": the pattern's name as the speaker says it, 1 to 4 words. The vocabulary is only for spelling: if the speaker's name for it is a vocabulary entry, possibly misheard, use the vocabulary's spelling. Never take a name from the vocabulary that the speaker does not say. Empty if "teaches" is false or no name is said.
- "description": a note for the dancer in your own words, 1 to 3 short sentences: the counts, what the lead and the follow do, and the tips. Do not copy the transcript; leave out counting-in, greetings and filler. Nothing that was not said. Empty if "teaches" is false.`;

/** The words the dancer already uses, for the model to match spellings against. */
export function vocabularyFor(
  list: Pick<IPatternList, "patternTypes" | "modifiers"> | null,
  patterns: Pick<IPattern, "name">[],
): string[] {
  const words = [
    ...patterns.map((p) => p.name),
    ...(list?.patternTypes ?? []).map((t) => t.slug),
    ...(list?.modifiers ?? []).map((m) => m.name),
  ]
    .map((w) => w.trim())
    .filter(Boolean);
  // First spelling wins: the pattern's own name before a type slug of the same word.
  const unique = new Map<string, string>();
  for (const word of words) {
    if (!unique.has(word.toLowerCase())) unique.set(word.toLowerCase(), word);
  }
  return [...unique.values()];
}

export function suggestionMessages(
  transcript: string,
  language: string,
  vocabulary: string[],
) {
  const name = languageName(language);
  return [
    { role: "system" as const, content: SYSTEM },
    {
      role: "user" as const,
      content:
        `Vocabulary: ${vocabulary.join(", ") || "(none)"}\n\n` +
        `Transcript:\n${transcript.trim()}\n\n` +
        (name
          ? `Write the name and the description in ${name}.`
          : "Write in the language of the transcript."),
    },
  ];
}

/** Reads the model's answer; tolerant of a stray prefix or suffix around the JSON object. */
export function parseSuggestion(text: string): Suggestion | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const raw = JSON.parse(text.slice(start, end + 1));
    if (typeof raw !== "object" || raw === null) return null;
    const clean = (v: unknown) =>
      typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
    // Asked first and stated plainly; a name after "no pattern here" is not believed.
    if (raw.teaches === false) return { name: "", description: "" };
    return { name: clean(raw.name), description: clean(raw.description) };
  } catch {
    return null;
  }
}
