import AsyncStorage from "@react-native-async-storage/async-storage";
import { migration001NormaliseShape } from "./001_normaliseShape";

/**
 * The shape this build expects stored data to be in.
 *
 * Bump it when adding a migration, and add the migration to `MIGRATIONS`.
 * Before this existed, compatibility was handled by defaulting at read time —
 * `modifiers: list.modifiers ?? []` and friends — which works for one field
 * and stops working for three, because nothing records what shape any given
 * record is actually in.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_VERSION_KEY = "@schemaVersion";

export interface Migration {
  /** The version this migration brings the data *up to*. */
  version: number;
  description: string;
  run: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [migration001NormaliseShape];

export interface MigrationOutcome {
  /** Version found in storage before anything ran. */
  from: number;
  /** Version in storage afterwards. */
  to: number;
  applied: string[];
  /** Set when the stored data is newer than this build understands. */
  aheadOfBuild?: boolean;
}

async function readStoredVersion(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    if (raw === null) return 0;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    // An unreadable version marker is treated as "oldest", which is safe
    // because every migration is idempotent.
    return 0;
  }
}

/**
 * Bring stored data up to `SCHEMA_VERSION`.
 *
 * Runs once at startup, before anything reads pattern data. Every migration
 * must be idempotent — a crash part-way through leaves the version marker
 * unchanged, so the same migration runs again on the next launch.
 *
 * Migrations never run backwards. If the stored data is *newer* than this
 * build (the user installed an older version over a newer one), nothing runs
 * and the marker is left alone: downgrading the data would lose whatever the
 * newer build added.
 */
export async function runMigrations(): Promise<MigrationOutcome> {
  const from = await readStoredVersion();

  if (from > SCHEMA_VERSION) {
    return { from, to: from, applied: [], aheadOfBuild: true };
  }
  if (from === SCHEMA_VERSION) {
    return { from, to: from, applied: [] };
  }

  const applied: string[] = [];
  let reached = from;

  for (const migration of MIGRATIONS) {
    if (migration.version <= from) continue;
    try {
      await migration.run();
    } catch (error) {
      // Stop at the first failure and record only what completed, so the next
      // launch retries from here rather than skipping a step.
      console.error(
        `Migration ${migration.version} (${migration.description}) failed:`,
        error,
      );
      break;
    }
    applied.push(migration.description);
    reached = migration.version;
  }

  if (reached !== from) {
    try {
      await AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(reached));
    } catch (error) {
      // The data is migrated but the marker did not stick; the migrations run
      // again next launch, which is harmless because they are idempotent.
      console.error("Could not record the schema version:", error);
    }
  }

  return { from, to: reached, applied };
}
