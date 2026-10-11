import { useSyncExternalStore } from "react";

/**
 * Settings' model downloads, held outside React on purpose: a download outlives the screen
 * that started it. Back from the background, Settings at times came up as a new tree (Android
 * recreates the activity), and a download kept in component state then showed "Not downloaded"
 * while it carried on, or had already finished, underneath. Keyed by the row, since a row can fetch several files.
 */
export type ModelDownloadState = {
  /** The fraction done while downloading, else null. */
  progress: number | null;
  failed: boolean;
  /** Known after a download or a delete here; undefined until then, so look at the files. */
  installed?: boolean;
};

const IDLE: ModelDownloadState = { progress: null, failed: false };
const states = new Map<string, ModelDownloadState>();
const listeners = new Set<() => void>();

function set(key: string, next: Partial<ModelDownloadState>): void {
  states.set(key, { ...(states.get(key) ?? IDLE), ...next });
  listeners.forEach((listener) => listener());
}

/** Starts the row's download unless it is already running. */
export function startModelDownload(
  key: string,
  run: (onFraction: (fraction: number) => void) => Promise<void>,
): void {
  if (states.get(key)?.progress != null) return;
  set(key, { progress: 0, failed: false });
  run((fraction) => set(key, { progress: fraction })).then(
    () => set(key, { progress: null, installed: true }),
    () => set(key, { progress: null, failed: true }),
  );
}

/** Records that the row's model was deleted. */
export function markModelDeleted(key: string): void {
  set(key, { installed: false, failed: false });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The row's download as it stands, whichever screen started it. */
export function useModelDownload(key: string): ModelDownloadState {
  return useSyncExternalStore(subscribe, () => states.get(key) ?? IDLE);
}

/** For tests: forgets every download's outcome. */
export function resetModelDownloads(): void {
  states.clear();
}
