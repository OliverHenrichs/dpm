import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UpdateCheck } from "@/modules/app-update";

const ASKED_KEY = "@updatePromptAsked";

/** Days before Play's update dialog shows again for a version the user said no to. */
export const ASK_AGAIN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The newest version Play's update dialog was shown for, and when. */
export type UpdateAsked = { versionCode: number; at: number };

/**
 * What to do about an update at launch:
 * - `restart`: one was downloaded earlier and waits; offer to restart into it.
 * - `ask`: Play has one and the user hasn't been asked about it lately; show Play's dialog.
 * - `none`: nothing new, one is already downloading, or the user said no less than
 *   `ASK_AGAIN_DAYS` ago.
 */
export function decideUpdatePrompt({
  check,
  asked,
  now,
}: {
  check: UpdateCheck;
  asked: UpdateAsked | null;
  now: number;
}): "restart" | "ask" | "none" {
  if (check.status === "downloaded") return "restart";
  if (!check.available || !check.flexibleAllowed) return "none";
  if (
    check.status === "pending" ||
    check.status === "downloading" ||
    check.status === "installing"
  )
    return "none";
  if (
    asked &&
    asked.versionCode >= check.availableVersionCode &&
    now - asked.at < ASK_AGAIN_DAYS * DAY_MS
  )
    return "none";
  return "ask";
}

/** A failed or unreadable value answers `null`, which at worst asks once more. */
export async function loadUpdateAsked(): Promise<UpdateAsked | null> {
  try {
    const raw = await AsyncStorage.getItem(ASKED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UpdateAsked>;
    if (typeof parsed.versionCode !== "number" || typeof parsed.at !== "number")
      return null;
    return { versionCode: parsed.versionCode, at: parsed.at };
  } catch (error) {
    console.error("Error reading the update prompt state:", error);
    return null;
  }
}

export async function saveUpdateAsked(asked: UpdateAsked): Promise<void> {
  try {
    await AsyncStorage.setItem(ASKED_KEY, JSON.stringify(asked));
  } catch (error) {
    console.error("Error saving the update prompt state:", error);
  }
}
