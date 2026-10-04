import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  setDoc,
  setLogLevel,
  writeBatch,
} from "firebase/firestore";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  SharedListDocument,
  SharedListOwnerDocument,
} from "@/src/firebase/FirebaseListService";
import {
  createTestPattern,
  createTestPatternList,
} from "@/utils/testFactories";

/**
 * Runs the real firestore.rules against the emulator, with one substitution:
 * the hash of the production app token is swapped for the hash of a test one,
 * so the suite never needs the real token.
 */
const TEST_TOKEN = "test-app-token";
const CODE = "AB12CD34";
const KEY = "k".repeat(43);
const PUBLISHER = "publisher-uid";
const SUBSCRIBER = "subscriber-uid";

function rulesWithTestToken(): string {
  const rules = readFileSync(
    resolve(__dirname, "../../firestore.rules"),
    "utf8",
  );
  const hashes = rules.match(/'[0-9a-f]{64}'/g) ?? [];
  // One hash in the file, or this substitution is no longer testing it.
  if (hashes.length !== 1) {
    throw new Error(
      `Expected one token hash in firestore.rules, found ${hashes.length}`,
    );
  }
  const testHash = createHash("sha256").update(TEST_TOKEN).digest("hex");
  return rules.replace(hashes[0] as string, `'${testHash}'`);
}

/** A document exactly as publishList() writes it. */
function sharedListDoc(
  overrides: Partial<SharedListDocument> = {},
): SharedListDocument {
  const list = createTestPatternList({ shareCode: CODE, nextPatternId: 3 });
  const typeId = list.patternTypes[0].id;
  return {
    list,
    patterns: [
      createTestPattern(typeId, { id: 1 }),
      createTestPattern(typeId, { id: 2, prerequisites: [1] }),
    ],
    publisherVersion: Date.now(),
    publishedAt: new Date().toISOString(),
    appToken: TEST_TOKEN,
    ...overrides,
  };
}

let env: RulesTestEnvironment;

beforeAll(async () => {
  // Every denied write is logged as a warning; denials are what most of
  // these tests expect.
  setLogLevel("silent");
  env = await initializeTestEnvironment({
    projectId: "demo-dpm",
    firestore: { rules: rulesWithTestToken() },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/** A publisher's or subscriber's device, signed in anonymously as `uid`. */
function as(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** A device that has not signed in: every subscriber, in the app. */
function anonymous(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

function owner(uid: string, key = KEY): SharedListOwnerDocument {
  return { ownerUid: uid, key };
}

/** What publishList() commits: the owner record and the list, in one batch. */
function publish(
  db: Firestore,
  data: object = sharedListDoc(),
  ownerData: object = owner(PUBLISHER),
  code = CODE,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "sharedListOwners", code), ownerData);
  batch.set(doc(db, "sharedLists", code), data);
  return batch.commit();
}

/** The batch unpublishList() commits once ownership is confirmed. */
function unpublish(db: Firestore): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "sharedLists", CODE));
  batch.delete(doc(db, "sharedListOwners", CODE));
  return batch.commit();
}

async function seed(
  list: object | null,
  ownerData: object | null = owner(PUBLISHER),
): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    if (list) await setDoc(doc(db, "sharedLists", CODE), list);
    if (ownerData) await setDoc(doc(db, "sharedListOwners", CODE), ownerData);
  });
}

describe("publishing", () => {
  it("accepts a first publish as publishList() writes it", async () => {
    await assertSucceeds(publish(as(PUBLISHER)));
  });

  it("accepts a re-publish by the owner (sync)", async () => {
    await seed(sharedListDoc());
    await assertSucceeds(
      publish(as(PUBLISHER), sharedListDoc({ patterns: [] })),
    );
  });

  it("refuses a publish from a device that has not signed in", async () => {
    await assertFails(publish(anonymous(), sharedListDoc(), owner("")));
  });

  it("refuses the list without its owner record", async () => {
    await assertFails(
      setDoc(doc(as(PUBLISHER), "sharedLists", CODE), sharedListDoc()),
    );
  });

  it("refuses an owner record naming someone else", async () => {
    await assertFails(
      publish(as(PUBLISHER), sharedListDoc(), owner(SUBSCRIBER)),
    );
  });

  it("refuses a short key", async () => {
    await assertFails(
      publish(as(PUBLISHER), sharedListDoc(), owner(PUBLISHER, "short")),
    );
  });

  it("refuses a write without the app token", async () => {
    const { appToken: _appToken, ...noToken } = sharedListDoc();
    await assertFails(publish(as(PUBLISHER), noToken));
  });

  it("refuses a write with the wrong app token", async () => {
    await assertFails(
      publish(as(PUBLISHER), sharedListDoc({ appToken: "guess" })),
    );
  });

  it("refuses a list stored under a code that is not its own", async () => {
    await assertFails(
      publish(as(PUBLISHER), sharedListDoc(), owner(PUBLISHER), "ZZZZZZZZ"),
    );
  });

  it.each(["ab12cd34", "AB12CD3", "AB12CD345", "AB12-D34"])(
    "refuses the malformed code %s",
    async (code) => {
      const data = sharedListDoc();
      data.list.shareCode = code;
      await assertFails(publish(as(PUBLISHER), data, owner(PUBLISHER), code));
    },
  );

  it("refuses a stored copy marked readonly", async () => {
    const data = sharedListDoc();
    data.list.readonly = true;
    await assertFails(publish(as(PUBLISHER), data));
  });

  it("refuses a published list carrying its share key", async () => {
    const data = sharedListDoc();
    data.list.shareKey = KEY;
    await assertFails(publish(as(PUBLISHER), data));
  });

  it("refuses fields the app does not write", async () => {
    await assertFails(
      publish(as(PUBLISHER), { ...sharedListDoc(), extra: "x" }),
    );
    await assertFails(
      publish(as(PUBLISHER), sharedListDoc(), {
        ...owner(PUBLISHER),
        extra: 1,
      }),
    );
  });

  it("refuses a document missing a field", async () => {
    const { publishedAt: _publishedAt, ...partial } = sharedListDoc();
    await assertFails(publish(as(PUBLISHER), partial));
  });

  it("refuses fields of the wrong type", async () => {
    await assertFails(
      publish(
        as(PUBLISHER),
        sharedListDoc({ patterns: "nope" as unknown as [] }),
      ),
    );
    await assertFails(
      publish(
        as(PUBLISHER),
        sharedListDoc({ publisherVersion: "1" as unknown as number }),
      ),
    );
  });
});

describe("ownership", () => {
  it("does not let a subscriber overwrite the list, even with an owner record", async () => {
    await seed(sharedListDoc());
    await assertFails(
      publish(
        as(SUBSCRIBER),
        sharedListDoc(),
        owner(SUBSCRIBER, "x".repeat(43)),
      ),
    );
    await assertFails(
      setDoc(doc(as(SUBSCRIBER), "sharedLists", CODE), sharedListDoc()),
    );
  });

  it("does not let a subscriber delete the list", async () => {
    await seed(sharedListDoc());
    await assertFails(deleteDoc(doc(as(SUBSCRIBER), "sharedLists", CODE)));
    await assertFails(deleteDoc(doc(anonymous(), "sharedLists", CODE)));
    await assertFails(deleteDoc(doc(as(SUBSCRIBER), "sharedListOwners", CODE)));
  });

  it("moves ownership to whoever presents the key (reinstall, new phone)", async () => {
    await seed(sharedListDoc());
    const newPhone = as("new-phone-uid");
    await assertSucceeds(
      publish(newPhone, sharedListDoc(), owner("new-phone-uid")),
    );
    // The old id no longer controls it on its own; only the key brings it
    // back, which is the same rule working the other way.
    await assertFails(
      setDoc(doc(as(PUBLISHER), "sharedLists", CODE), sharedListDoc()),
    );
    await assertFails(deleteDoc(doc(as(PUBLISHER), "sharedLists", CODE)));
  });

  it("lets the owner unpublish: the list and its owner record go together", async () => {
    await seed(sharedListDoc());
    await assertSucceeds(unpublish(as(PUBLISHER)));
  });

  it("lets a new phone with the key take over and then unpublish", async () => {
    await seed(sharedListDoc());
    const newPhone = as("new-phone-uid");
    await assertSucceeds(
      setDoc(doc(newPhone, "sharedListOwners", CODE), owner("new-phone-uid")),
    );
    await assertSucceeds(unpublish(newPhone));
  });

  it("lets a list published before owner records be claimed", async () => {
    await seed(sharedListDoc(), null);
    await assertSucceeds(publish(as(PUBLISHER)));
  });

  it("hides owner records from everyone, the owner included", async () => {
    await seed(sharedListDoc());
    await assertFails(getDoc(doc(as(PUBLISHER), "sharedListOwners", CODE)));
    await assertFails(getDocs(collection(as(PUBLISHER), "sharedListOwners")));
  });
});

describe("reading", () => {
  it("lets anyone with the code read a list, without signing in", async () => {
    await seed(sharedListDoc());
    const snap = await assertSucceeds(
      getDoc(doc(anonymous(), "sharedLists", CODE)),
    );
    expect(snap.exists()).toBe(true);
  });

  it("answers a code that does not exist with not-found, not an error", async () => {
    const snap = await assertSucceeds(
      getDoc(doc(anonymous(), "sharedLists", CODE)),
    );
    expect(snap.exists()).toBe(false);
  });

  it("does not let anyone enumerate the shared lists", async () => {
    await seed(sharedListDoc());
    await assertFails(getDocs(collection(anonymous(), "sharedLists")));
    await assertFails(getDocs(collection(as(PUBLISHER), "sharedLists")));
  });
});

describe("everything else", () => {
  it("denies other collections", async () => {
    await assertFails(setDoc(doc(as(PUBLISHER), "other", "x"), { a: 1 }));
    await assertFails(getDoc(doc(anonymous(), "other", "x")));
  });

  it("denies subcollections of a shared list", async () => {
    await seed(sharedListDoc());
    await assertFails(
      setDoc(
        doc(as(PUBLISHER), "sharedLists", CODE, "extra", "x"),
        sharedListDoc(),
      ),
    );
  });
});
