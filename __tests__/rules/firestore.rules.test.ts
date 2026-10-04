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
} from "firebase/firestore";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { SharedListDocument } from "@/src/firebase/FirebaseListService";
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
let db: Firestore;

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
  // The app never signs in.
  db = env.unauthenticatedContext().firestore() as unknown as Firestore;
});

async function seed(code: string, data: object): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "sharedLists", code), data);
  });
}

describe("publishing", () => {
  it("accepts a list as publishList() writes it", async () => {
    await assertSucceeds(setDoc(doc(db, "sharedLists", CODE), sharedListDoc()));
  });

  it("accepts a re-publish over an existing list (sync)", async () => {
    await seed(CODE, sharedListDoc());
    await assertSucceeds(
      setDoc(doc(db, "sharedLists", CODE), sharedListDoc({ patterns: [] })),
    );
  });

  it("rejects a write without the app token", async () => {
    const { appToken: _appToken, ...noToken } = sharedListDoc();
    await assertFails(setDoc(doc(db, "sharedLists", CODE), noToken));
  });

  it("rejects a write with the wrong app token", async () => {
    await assertFails(
      setDoc(
        doc(db, "sharedLists", CODE),
        sharedListDoc({ appToken: "guess" }),
      ),
    );
  });

  it("rejects a list stored under a code that is not its own", async () => {
    await assertFails(
      setDoc(doc(db, "sharedLists", "ZZZZZZZZ"), sharedListDoc()),
    );
  });

  it.each(["ab12cd34", "AB12CD3", "AB12CD345", "AB12-D34"])(
    "rejects the malformed code %s",
    async (code) => {
      const data = sharedListDoc();
      data.list.shareCode = code;
      await assertFails(setDoc(doc(db, "sharedLists", code), data));
    },
  );

  it("rejects a stored copy marked readonly", async () => {
    const data = sharedListDoc();
    data.list.readonly = true;
    await assertFails(setDoc(doc(db, "sharedLists", CODE), data));
  });

  it("rejects fields the app does not write", async () => {
    await assertFails(
      setDoc(doc(db, "sharedLists", CODE), {
        ...sharedListDoc(),
        extra: "x",
      }),
    );
  });

  it("rejects a document missing a field", async () => {
    const { publishedAt: _publishedAt, ...partial } = sharedListDoc();
    await assertFails(setDoc(doc(db, "sharedLists", CODE), partial));
  });

  it("rejects fields of the wrong type", async () => {
    await assertFails(
      setDoc(
        doc(db, "sharedLists", CODE),
        sharedListDoc({ patterns: "nope" as unknown as [] }),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, "sharedLists", CODE),
        sharedListDoc({ publisherVersion: "1" as unknown as number }),
      ),
    );
  });
});

describe("reading", () => {
  it("lets anyone with the code read a list", async () => {
    await seed(CODE, sharedListDoc());
    const snap = await assertSucceeds(getDoc(doc(db, "sharedLists", CODE)));
    expect(snap.exists()).toBe(true);
  });

  it("answers a code that does not exist with not-found, not an error", async () => {
    const snap = await assertSucceeds(getDoc(doc(db, "sharedLists", CODE)));
    expect(snap.exists()).toBe(false);
  });

  it("does not let anyone enumerate the shared lists", async () => {
    await seed(CODE, sharedListDoc());
    await assertFails(getDocs(collection(db, "sharedLists")));
  });
});

describe("unpublishing", () => {
  it("lets the code's holder delete the list", async () => {
    await seed(CODE, sharedListDoc());
    await assertSucceeds(deleteDoc(doc(db, "sharedLists", CODE)));
  });
});

describe("everything else", () => {
  it("denies other collections", async () => {
    await assertFails(setDoc(doc(db, "other", "x"), { a: 1 }));
    await assertFails(getDoc(doc(db, "other", "x")));
  });

  it("denies subcollections of a shared list", async () => {
    await seed(CODE, sharedListDoc());
    await assertFails(
      setDoc(doc(db, "sharedLists", CODE, "extra", "x"), sharedListDoc()),
    );
  });
});
