/**
 * Which export files this build can read.
 *
 * `exportDataVersion` is what we *write*; this is what we *accept*. Keeping
 * them apart is the point: a future release that adds a field bumps the minor
 * version and older builds can still refuse it deliberately, with a message,
 * rather than parsing half of it and writing the result to storage.
 */
export const SUPPORTED_MAJOR = 3;

/** Highest minor version this build understands within `SUPPORTED_MAJOR`. */
export const SUPPORTED_MINOR = 0;

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/** Parse a `major.minor.patch` string. Returns null for anything else. */
export function parseVersion(version: unknown): ParsedVersion | null {
  if (typeof version !== "string") return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export type ImportCompatibility =
  | { supported: true; version: ParsedVersion }
  | { supported: false; reason: "unparseable" | "tooOld" | "tooNew" };

/**
 * Whether a file claiming `version` can be imported.
 *
 * A patch difference is always fine — patches never change the shape. A newer
 * *minor* is refused rather than best-effort parsed: the writer added
 * something this build does not know how to carry, and silently dropping it on
 * the next save would lose the user's data without ever saying so.
 */
export function canImport(version: unknown): ImportCompatibility {
  const parsed = parseVersion(version);
  if (!parsed) return { supported: false, reason: "unparseable" };
  if (parsed.major !== SUPPORTED_MAJOR) {
    return {
      supported: false,
      reason: parsed.major < SUPPORTED_MAJOR ? "tooOld" : "tooNew",
    };
  }
  if (parsed.minor > SUPPORTED_MINOR) {
    return { supported: false, reason: "tooNew" };
  }
  return { supported: true, version: parsed };
}
