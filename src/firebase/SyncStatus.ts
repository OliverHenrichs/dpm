import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether the last push of a published list failed, per share code. Edits push on their own
 * and never fail because of it, so this is the only place such a failure shows: the sharing
 * sheet reads it to offer a retry. Kept on the phone only.
 */
const key = (shareCode: string) => `@syncFailed_${shareCode}`;

export async function recordSyncFailure(shareCode: string): Promise<void> {
  await AsyncStorage.setItem(key(shareCode), String(Date.now()));
}

export async function clearSyncFailure(shareCode: string): Promise<void> {
  await AsyncStorage.removeItem(key(shareCode));
}

/** When the last push of this list failed; null when it went through. */
export async function lastSyncFailure(
  shareCode: string,
): Promise<number | null> {
  const stored = await AsyncStorage.getItem(key(shareCode));
  const at = stored === null ? NaN : Number(stored);
  return Number.isFinite(at) ? at : null;
}
