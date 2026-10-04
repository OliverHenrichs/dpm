import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateShareKey } from "@/src/firebase/shareKey";
import { migration002ShareKeys } from "@/src/pattern/data/migrations/002_shareKeys";
import {
  getPatternListById,
  savePatternList,
} from "@/src/pattern/data/PatternListStorage";
import { IPatternList } from "@/src/pattern/types/IPatternList";
import { createTestPatternList } from "@/utils/testFactories";

const KEY = "k".repeat(43);

/** Write lists exactly as an older build left them, bypassing the helpers. */
async function seedRaw(lists: IPatternList[]): Promise<void> {
  await AsyncStorage.setItem("@patternLists", JSON.stringify(lists));
}

describe("generateShareKey", () => {
  it("makes long, URL-safe, different keys", () => {
    const keys = new Set(Array.from({ length: 50 }, generateShareKey));

    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("savePatternList keeps a share key exactly on lists this device publishes", () => {
  it("gives a newly published list a key", async () => {
    const list = createTestPatternList({ shareCode: "ABCD1234" });
    await savePatternList(list);

    expect((await getPatternListById(list.id))?.shareKey).toMatch(/^.{43}$/);
  });

  it("keeps the key it was given", async () => {
    const list = createTestPatternList({
      shareCode: "ABCD1234",
      shareKey: KEY,
    });
    await savePatternList(list);

    expect((await getPatternListById(list.id))?.shareKey).toBe(KEY);
  });

  it("keeps the stored key when handed an older copy without one", async () => {
    // Minting a new key here would lock the device out of its own list: the
    // owner record in Firestore holds the old one.
    const list = createTestPatternList({
      shareCode: "ABCD1234",
      shareKey: KEY,
    });
    await savePatternList(list);
    const { shareKey: _shareKey, ...olderCopy } = list;
    await savePatternList({ ...olderCopy, name: "Renamed" });

    const stored = await getPatternListById(list.id);
    expect(stored).toMatchObject({ name: "Renamed", shareKey: KEY });
  });

  it("drops the key when the list stops being published", async () => {
    const list = createTestPatternList({
      shareCode: "ABCD1234",
      shareKey: KEY,
    });
    await savePatternList(list);
    const { shareCode: _shareCode, ...unpublished } = list;
    await savePatternList(unpublished);

    expect(await getPatternListById(list.id)).not.toHaveProperty("shareKey");
  });

  it("never keeps a key on a read-only (subscribed) copy", async () => {
    const list = createTestPatternList({
      shareCode: "ABCD1234",
      shareKey: KEY,
      readonly: true,
    });
    await savePatternList(list);

    expect(await getPatternListById(list.id)).not.toHaveProperty("shareKey");
  });

  it("leaves an unpublished list without a key", async () => {
    const list = createTestPatternList();
    await savePatternList(list);

    expect(await getPatternListById(list.id)).not.toHaveProperty("shareKey");
  });
});

describe("migration 002", () => {
  it("gives lists published before share keys their key, and nobody else one", async () => {
    const published = createTestPatternList({ shareCode: "ABCD1234" });
    const subscribed = createTestPatternList({
      shareCode: "WXYZ9876",
      readonly: true,
    });
    const local = createTestPatternList();
    await seedRaw([published, subscribed, local]);

    await migration002ShareKeys.run();

    expect((await getPatternListById(published.id))?.shareKey).toMatch(
      /^.{43}$/,
    );
    expect(await getPatternListById(subscribed.id)).not.toHaveProperty(
      "shareKey",
    );
    expect(await getPatternListById(local.id)).not.toHaveProperty("shareKey");
  });

  it("is idempotent: a second run keeps the key the first one made", async () => {
    const published = createTestPatternList({ shareCode: "ABCD1234" });
    await seedRaw([published]);

    await migration002ShareKeys.run();
    const first = (await getPatternListById(published.id))?.shareKey;
    await migration002ShareKeys.run();

    expect((await getPatternListById(published.id))?.shareKey).toBe(first);
  });
});
