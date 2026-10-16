import { requireOptionalNativeModule } from "expo";

/**
 * The clipboard, for the link the user copied in another app. `expo-clipboard` reads its native
 * module at import, so it is required only where this build has it (not web's SSR pass, Jest, or a
 * dev client built before it was added); without it, nothing is offered.
 */
export const canReadClipboard =
  requireOptionalNativeModule("ExpoClipboard") !== null;

type Clipboard = typeof import("expo-clipboard");

function clipboard(): Clipboard | null {
  if (!canReadClipboard) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-clipboard") as Clipboard;
  } catch {
    return null;
  }
}

/**
 * Whether something was copied. Asking does not read it, so Android shows no "pasted from your
 * clipboard" notice until the user taps to paste.
 */
export async function hasCopiedText(): Promise<boolean> {
  try {
    return (await clipboard()?.hasStringAsync()) ?? false;
  } catch {
    return false;
  }
}

/** What was copied, or null. */
export async function readCopiedText(): Promise<string | null> {
  try {
    return (await clipboard()?.getStringAsync()) ?? null;
  } catch {
    return null;
  }
}
