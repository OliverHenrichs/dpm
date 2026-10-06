import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  correctionsFromEdit,
  mergeCorrections,
  TranscriptCorrection,
} from "@/src/transcribe/corrections";
import { getTranscriptCorrectionsKey } from "@/src/transcribe/data/CorrectionKeys";

/**
 * A list's remembered transcript corrections, newest first. On this phone only: they are words
 * from transcripts, which stay private (`src/transcribe/AGENTS.md`), so they are neither exported
 * nor published. A read never throws; it degrades to none.
 */
export async function loadCorrections(
  listId: string,
): Promise<TranscriptCorrection[]> {
  try {
    const raw = await AsyncStorage.getItem(getTranscriptCorrectionsKey(listId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCorrection) : [];
  } catch (error) {
    console.error("Error loading transcript corrections:", error);
    return [];
  }
}

// Read-modify-write per list, queued so two quick edits cannot lose one another.
const chains = new Map<string, Promise<unknown>>();

/**
 * Learns from the user's edit of one transcript line: what they fixed is applied to the list's
 * later transcripts. Edits that fix no misheard word (`correctionsFromEdit`) change nothing.
 */
export function rememberCorrections(
  listId: string,
  before: string,
  after: string,
): Promise<void> {
  const learned = correctionsFromEdit(before, after);
  if (learned.length === 0) return Promise.resolve();
  const work = async () => {
    const merged = mergeCorrections(await loadCorrections(listId), learned);
    await AsyncStorage.setItem(
      getTranscriptCorrectionsKey(listId),
      JSON.stringify(merged),
    );
  };
  const result = (chains.get(listId) ?? Promise.resolve()).then(work, work);
  chains.set(
    listId,
    result.catch(() => undefined),
  );
  return result;
}

function isCorrection(value: unknown): value is TranscriptCorrection {
  const c = value as Partial<TranscriptCorrection> | null;
  return (
    typeof c?.from === "string" &&
    typeof c.to === "string" &&
    c.from !== "" &&
    c.to !== ""
  );
}
