import AsyncStorage from "@react-native-async-storage/async-storage";
import { seedAsyncStorage } from "@/__mocks__/@react-native-async-storage/async-storage";
import {
  runMigrations,
  SCHEMA_VERSION,
  SCHEMA_VERSION_KEY,
} from "@/src/pattern/data/migrations";
import { migration001NormaliseShape } from "@/src/pattern/data/migrations/001_normaliseShape";
import {
  loadAllPatternLists,
  loadPatterns,
  savePatternList,
  savePatterns,
} from "@/src/pattern/data/PatternListStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

const LISTS_KEY = "@patternLists";
const patternsKey = (id: string) => `@patterns_${id}`;

const storedVersion = () => AsyncStorage.getItem(SCHEMA_VERSION_KEY);

const rawLists = async (): Promise<Record<string, unknown>[]> =>
  JSON.parse((await AsyncStorage.getItem(LISTS_KEY)) ?? "[]");

describe("runMigrations", () => {
  describe("version tracking", () => {
    it("records the current version on a fresh install", async () => {
      const outcome = await runMigrations();

      expect(outcome.from).toBe(0);
      expect(outcome.to).toBe(SCHEMA_VERSION);
      expect(await storedVersion()).toBe(String(SCHEMA_VERSION));
    });

    it("does nothing when already current", async () => {
      seedAsyncStorage({ [SCHEMA_VERSION_KEY]: String(SCHEMA_VERSION) });

      const outcome = await runMigrations();

      expect(outcome.applied).toEqual([]);
      expect(outcome.to).toBe(SCHEMA_VERSION);
    });

    it("is idempotent across repeated launches", async () => {
      const list = createTestPatternList();
      await savePatternList(list);
      await savePatterns(list.id, [createTestPattern("t", { id: 1 })]);

      await runMigrations();
      const afterFirst = await rawLists();
      await runMigrations();

      expect(await rawLists()).toEqual(afterFirst);
    });

    it("treats an unreadable version marker as the oldest", async () => {
      seedAsyncStorage({ [SCHEMA_VERSION_KEY]: "not a number" });

      const outcome = await runMigrations();

      expect(outcome.from).toBe(0);
      expect(outcome.to).toBe(SCHEMA_VERSION);
    });

    it("never migrates backwards", async () => {
      // The user installed an older build over a newer one. Downgrading the
      // data would discard whatever the newer build added.
      seedAsyncStorage({ [SCHEMA_VERSION_KEY]: String(SCHEMA_VERSION + 5) });

      const outcome = await runMigrations();

      expect(outcome.aheadOfBuild).toBe(true);
      expect(outcome.applied).toEqual([]);
      expect(await storedVersion()).toBe(String(SCHEMA_VERSION + 5));
    });
  });

  describe("when a migration fails", () => {
    it("leaves the version marker alone so it retries next launch", async () => {
      jest
        .spyOn(migration001NormaliseShape, "run")
        .mockRejectedValueOnce(new Error("storage unavailable"));

      const outcome = await runMigrations();

      expect(outcome.applied).toEqual([]);
      expect(outcome.to).toBe(0);
      expect(await storedVersion()).toBeNull();
    });

    it("does not throw, so startup is never blocked by it", async () => {
      jest
        .spyOn(migration001NormaliseShape, "run")
        .mockRejectedValueOnce(new Error("storage unavailable"));

      await expect(runMigrations()).resolves.toMatchObject({ to: 0 });
    });
  });
});

describe("migration 001 — normalise stored shape", () => {
  it("strips a patterns array duplicated into the list record", async () => {
    // What the import and cloud-subscribe paths used to write (B10).
    const list = createTestPatternList();
    seedAsyncStorage({
      [LISTS_KEY]: JSON.stringify([
        { ...list, patterns: [createTestPattern("t", { id: 1 })] },
      ]),
    });

    await runMigrations();

    expect((await rawLists())[0]).not.toHaveProperty("patterns");
  });

  it("drops prerequisite ids that match no pattern", async () => {
    // What deleting a pattern used to leave behind (B1).
    const list = createTestPatternList();
    seedAsyncStorage({
      [LISTS_KEY]: JSON.stringify([list]),
      [patternsKey(list.id)]: JSON.stringify([
        createTestPattern("t", { id: 2, prerequisites: [1] }),
        createTestPattern("t", { id: 3, prerequisites: [2, 99] }),
      ]),
    });

    await runMigrations();

    const stored = JSON.parse(
      (await AsyncStorage.getItem(patternsKey(list.id))) ?? "[]",
    );
    expect(
      stored.map((p: { prerequisites: number[] }) => p.prerequisites),
    ).toEqual([[], [2]]);
  });

  it("fills in modifiers on a list written before they existed", async () => {
    const legacy = createTestPatternList();
    delete (legacy as Partial<IPatternList>).modifiers;
    seedAsyncStorage({ [LISTS_KEY]: JSON.stringify([legacy]) });

    await runMigrations();

    expect((await rawLists())[0].modifiers).toEqual([]);
  });

  it("fills in modifierRefs on patterns written before they existed", async () => {
    const list = createTestPatternList();
    const legacy = createTestPattern("t", { id: 1 });
    delete (legacy as Partial<typeof legacy>).modifierRefs;
    seedAsyncStorage({
      [LISTS_KEY]: JSON.stringify([list]),
      [patternsKey(list.id)]: JSON.stringify([legacy]),
    });

    await runMigrations();

    const [stored] = JSON.parse(
      (await AsyncStorage.getItem(patternsKey(list.id))) ?? "[]",
    );
    expect(stored.modifierRefs).toEqual([]);
  });

  it("leaves healthy data unchanged apart from its timestamp", async () => {
    const list = createTestPatternList({ name: "Salsa" });
    await savePatternList(list);
    await savePatterns(list.id, [createTestPattern("t", { id: 1 })]);

    await runMigrations();

    const [stored] = await loadAllPatternLists();
    expect(stored).toMatchObject({ id: list.id, name: "Salsa" });
    await expect(loadPatterns(list.id)).resolves.toHaveLength(1);
  });

  it("copes with several lists at once", async () => {
    const a = createTestPatternList({ name: "A" });
    const b = createTestPatternList({ name: "B" });
    seedAsyncStorage({
      [LISTS_KEY]: JSON.stringify([a, b]),
      [patternsKey(a.id)]: JSON.stringify([
        createTestPattern("t", { id: 2, prerequisites: [1] }),
      ]),
      [patternsKey(b.id)]: JSON.stringify([createTestPattern("t", { id: 1 })]),
    });

    await runMigrations();

    expect(await loadAllPatternLists()).toHaveLength(2);
    const aPatterns = await loadPatterns(a.id);
    expect(aPatterns[0].prerequisites).toEqual([]);
  });

  it("copes with no data at all", async () => {
    await expect(runMigrations()).resolves.toMatchObject({
      to: SCHEMA_VERSION,
    });
    expect(await loadAllPatternLists()).toEqual([]);
  });
});
