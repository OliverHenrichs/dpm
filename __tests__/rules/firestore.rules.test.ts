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
  serverTimestamp,
  setDoc,
  Timestamp,
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
import type { ISuggestionPolicy } from "@/src/pattern/types/IPatternList";
import {
  counterIdFor,
  suggestedPattern,
} from "@/src/pattern/suggestions/suggestions";
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

  it("keeps a list taken down by the operator from coming back (tools/data-removal)", async () => {
    // What `remove-list` leaves: no list, and an owner record with a fresh
    // key nobody holds, naming an owner no device can be.
    await seed(null, {
      ownerUid: "removed-by-operator",
      key: "t".repeat(64),
      removedAt: Timestamp.now(),
    });
    await assertFails(publish(as(PUBLISHER)));
    await assertFails(unpublish(as(PUBLISHER)));
    await assertFails(
      setDoc(doc(as(PUBLISHER), "sharedListOwners", CODE), owner(PUBLISHER)),
    );
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

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const OTHER = "other-subscriber-uid";

/** A shared list that takes suggestions under `policy`. */
function listTakingSuggestions(
  policy: ISuggestionPolicy = { dailyLimit: 2, per: "subscriber" },
): SharedListDocument {
  const data = sharedListDoc();
  data.list.suggestions = policy;
  return data;
}

function suggestionPattern(name = "Sugar Tuck") {
  const typeId = sharedListDoc().list.patternTypes[0].id;
  return suggestedPattern({
    ...createTestPattern(typeId, { id: 99, name, prerequisites: [1] }),
  });
}

let suggestionSeq = 0;

/**
 * What submitSuggestion() commits: the suggestion and today's counter, one up. `count` is the
 * counter's new value; the overrides bend one part of it for the refusals.
 */
function suggest(
  db: Firestore,
  uid: string,
  count: number,
  opts: {
    policy?: ISuggestionPolicy;
    counterId?: string;
    data?: Record<string, unknown>;
    last?: string;
    withoutCounter?: boolean;
  } = {},
): Promise<void> {
  const id = `s${++suggestionSeq}`;
  const policy = opts.policy ?? { dailyLimit: 2, per: "subscriber" };
  const batch = writeBatch(db);
  batch.set(doc(db, "sharedLists", CODE, "suggestions", id), {
    authorUid: uid,
    authorName: "Alex",
    pattern: suggestionPattern(),
    createdAt: serverTimestamp(),
    appToken: TEST_TOKEN,
    ...opts.data,
  });
  if (!opts.withoutCounter) {
    batch.set(
      doc(
        db,
        "sharedLists",
        CODE,
        "suggestionCounters",
        opts.counterId ?? counterIdFor(policy, uid),
      ),
      { count, last: opts.last ?? id },
    );
  }
  return batch.commit();
}

async function seedDoc(path: string[], data: object): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const [first, ...rest] = path;
    await setDoc(doc(ctx.firestore(), first as string, ...rest), data);
  });
}

describe("suggestion settings", () => {
  it("accepts a published list that takes suggestions", async () => {
    await assertSucceeds(publish(as(PUBLISHER), listTakingSuggestions()));
    await assertSucceeds(
      publish(
        as(PUBLISHER),
        listTakingSuggestions({ dailyLimit: 100, per: "list" }),
      ),
    );
  });

  it.each([
    { dailyLimit: 0, per: "list" },
    { dailyLimit: 101, per: "list" },
    { dailyLimit: 1.5, per: "list" },
    { dailyLimit: 3, per: "everyone" },
    { dailyLimit: 3 },
    { dailyLimit: 3, per: "list", extra: true },
  ])("refuses the malformed setting %j", async (policy) => {
    await assertFails(
      publish(
        as(PUBLISHER),
        listTakingSuggestions(policy as unknown as ISuggestionPolicy),
      ),
    );
  });
});

describe("suggesting", () => {
  it("accepts a suggestion with today's counter", async () => {
    await seed(listTakingSuggestions());
    await assertSucceeds(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
    await assertSucceeds(suggest(as(SUBSCRIBER), SUBSCRIBER, 2));
  });

  it("accepts a suggestion without a name", async () => {
    await seed(listTakingSuggestions());
    const { authorName: _name, ...data } = {
      authorUid: SUBSCRIBER,
      authorName: "x",
      pattern: suggestionPattern(),
      createdAt: serverTimestamp(),
      appToken: TEST_TOKEN,
    };
    const db = as(SUBSCRIBER);
    const batch = writeBatch(db);
    batch.set(doc(db, "sharedLists", CODE, "suggestions", "anon"), data);
    batch.set(
      doc(
        db,
        "sharedLists",
        CODE,
        "suggestionCounters",
        counterIdFor({ dailyLimit: 2, per: "subscriber" }, SUBSCRIBER),
      ),
      { count: 1, last: "anon" },
    );
    await assertSucceeds(batch.commit());
  });

  it("refuses a suggestion past the limit per subscriber, but not another subscriber's", async () => {
    await seed(listTakingSuggestions({ dailyLimit: 1, per: "subscriber" }));
    await assertSucceeds(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 2));
    // Restarting the count is no way round it.
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
    await assertSucceeds(suggest(as(OTHER), OTHER, 1));
  });

  it("counts every subscriber against a limit for the whole list", async () => {
    const policy: ISuggestionPolicy = { dailyLimit: 2, per: "list" };
    await seed(listTakingSuggestions(policy));
    await assertSucceeds(suggest(as(SUBSCRIBER), SUBSCRIBER, 1, { policy }));
    await assertSucceeds(suggest(as(OTHER), OTHER, 2, { policy }));
    await assertFails(suggest(as(OTHER), OTHER, 3, { policy }));
  });

  it("refuses a suggestion counted in the wrong counter", async () => {
    await seed(listTakingSuggestions({ dailyLimit: 5, per: "list" }));
    // The policy counts for the whole list, so a per-subscriber counter is not it.
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
  });

  it("refuses a suggestion to a list that does not take them", async () => {
    await seed(sharedListDoc());
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
  });

  it("refuses a suggestion to a list that does not exist", async () => {
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
  });

  it("refuses a muted subscriber, and only them", async () => {
    await seed(listTakingSuggestions());
    await seedDoc(["sharedLists", CODE, "subscribers", SUBSCRIBER], {
      status: "muted",
      updatedAt: Timestamp.now(),
    });
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
    await assertSucceeds(suggest(as(OTHER), OTHER, 1));
  });

  it("refuses a device that has not signed in", async () => {
    await seed(listTakingSuggestions());
    await assertFails(suggest(anonymous(), SUBSCRIBER, 1));
  });

  it("refuses a suggestion in someone else's name", async () => {
    await seed(listTakingSuggestions());
    await assertFails(
      suggest(as(SUBSCRIBER), SUBSCRIBER, 1, { data: { authorUid: OTHER } }),
    );
  });

  it("refuses a suggestion without its counter", async () => {
    await seed(listTakingSuggestions());
    await assertFails(
      suggest(as(SUBSCRIBER), SUBSCRIBER, 1, { withoutCounter: true }),
    );
  });

  it("refuses a counter that skips ahead or names another suggestion", async () => {
    await seed(listTakingSuggestions({ dailyLimit: 5, per: "subscriber" }));
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 2));
    await assertFails(
      suggest(as(SUBSCRIBER), SUBSCRIBER, 1, { last: "someone-else" }),
    );
  });

  it("refuses counting into another day or another subscriber's counter", async () => {
    await seed(listTakingSuggestions({ dailyLimit: 5, per: "subscriber" }));
    const tomorrow = Date.now() + 86_400_000;
    const policy: ISuggestionPolicy = { dailyLimit: 5, per: "subscriber" };
    // A counter write on its own, alongside a valid suggestion and counter.
    const db = as(SUBSCRIBER);
    const id = "with-extra";
    const batch = writeBatch(db);
    batch.set(doc(db, "sharedLists", CODE, "suggestions", id), {
      authorUid: SUBSCRIBER,
      pattern: suggestionPattern(),
      createdAt: serverTimestamp(),
      appToken: TEST_TOKEN,
    });
    batch.set(
      doc(
        db,
        "sharedLists",
        CODE,
        "suggestionCounters",
        counterIdFor(policy, SUBSCRIBER),
      ),
      { count: 1, last: id },
    );
    batch.set(
      doc(
        db,
        "sharedLists",
        CODE,
        "suggestionCounters",
        counterIdFor(policy, SUBSCRIBER, tomorrow),
      ),
      { count: 1, last: id },
    );
    await assertFails(batch.commit());

    await assertFails(
      suggest(as(SUBSCRIBER), SUBSCRIBER, 1, {
        counterId: counterIdFor(policy, OTHER),
      }),
    );
  });

  it("refuses a counter bumped without a suggestion", async () => {
    await seed(listTakingSuggestions());
    await assertFails(
      setDoc(
        doc(
          as(SUBSCRIBER),
          "sharedLists",
          CODE,
          "suggestionCounters",
          counterIdFor({ dailyLimit: 2, per: "subscriber" }, SUBSCRIBER),
        ),
        { count: 1, last: "nothing" },
      ),
    );
  });

  it.each([
    ["a client timestamp", { createdAt: Timestamp.now() }],
    ["no app token", { appToken: "guess" }],
    ["an extra field", { extra: 1 }],
    ["a long name", { authorName: "x".repeat(41) }],
    ["no pattern name", { pattern: { ...suggestionPattern(), name: "" } }],
    [
      "a pattern field the app does not write",
      { pattern: { ...suggestionPattern(), id: 3 } },
    ],
    [
      "too many videos",
      {
        pattern: {
          ...suggestionPattern(),
          videoRefs: Array.from({ length: 11 }, () => ({
            type: "url",
            value: "https://youtu.be/x",
          })),
        },
      },
    ],
  ])("refuses a suggestion with %s", async (_label, data) => {
    await seed(listTakingSuggestions());
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1, { data }));
  });

  it("does not let a subscriber change a suggestion once sent", async () => {
    await seed(listTakingSuggestions());
    await suggest(as(SUBSCRIBER), SUBSCRIBER, 1);
    await assertFails(
      setDoc(
        doc(
          as(SUBSCRIBER),
          "sharedLists",
          CODE,
          "suggestions",
          `s${suggestionSeq}`,
        ),
        { authorUid: SUBSCRIBER },
        { merge: true },
      ),
    );
  });
});

describe("reading suggestions", () => {
  beforeEach(async () => {
    await seed(listTakingSuggestions());
    await suggest(as(SUBSCRIBER), SUBSCRIBER, 1);
  });

  it("lets the owner read and delete them", async () => {
    const snap = await assertSucceeds(
      getDocs(collection(as(PUBLISHER), "sharedLists", CODE, "suggestions")),
    );
    expect(snap.size).toBe(1);
    await assertSucceeds(
      deleteDoc(
        doc(
          as(PUBLISHER),
          "sharedLists",
          CODE,
          "suggestions",
          `s${suggestionSeq}`,
        ),
      ),
    );
  });

  it("hides them from subscribers, their author included", async () => {
    await assertFails(
      getDocs(collection(as(SUBSCRIBER), "sharedLists", CODE, "suggestions")),
    );
    await assertFails(
      getDoc(
        doc(
          as(SUBSCRIBER),
          "sharedLists",
          CODE,
          "suggestions",
          `s${suggestionSeq}`,
        ),
      ),
    );
    await assertFails(
      deleteDoc(
        doc(
          as(SUBSCRIBER),
          "sharedLists",
          CODE,
          "suggestions",
          `s${suggestionSeq}`,
        ),
      ),
    );
  });

  it("lets a subscriber read a counter, but not list or delete them", async () => {
    const id = counterIdFor({ dailyLimit: 2, per: "subscriber" }, SUBSCRIBER);
    const snap = await assertSucceeds(
      getDoc(
        doc(as(SUBSCRIBER), "sharedLists", CODE, "suggestionCounters", id),
      ),
    );
    expect(snap.data()?.count).toBe(1);
    await assertFails(
      getDocs(
        collection(as(SUBSCRIBER), "sharedLists", CODE, "suggestionCounters"),
      ),
    );
    await assertFails(
      deleteDoc(
        doc(as(SUBSCRIBER), "sharedLists", CODE, "suggestionCounters", id),
      ),
    );
    await assertSucceeds(
      deleteDoc(
        doc(as(PUBLISHER), "sharedLists", CODE, "suggestionCounters", id),
      ),
    );
  });
});

describe("muting", () => {
  const record = (db: Firestore, uid = SUBSCRIBER) =>
    doc(db, "sharedLists", CODE, "subscribers", uid);

  beforeEach(async () => {
    await seed(listTakingSuggestions());
  });

  it("lets the owner mute and unmute a subscriber", async () => {
    await assertSucceeds(
      setDoc(record(as(PUBLISHER)), {
        status: "muted",
        name: "Alex",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      getDocs(collection(as(PUBLISHER), "sharedLists", CODE, "subscribers")),
    );
    await assertSucceeds(deleteDoc(record(as(PUBLISHER))));
  });

  it("does not let a subscriber mute or unmute anyone, themselves included", async () => {
    await assertFails(
      setDoc(record(as(SUBSCRIBER), OTHER), {
        status: "muted",
        updatedAt: serverTimestamp(),
      }),
    );
    await seedDoc(["sharedLists", CODE, "subscribers", SUBSCRIBER], {
      status: "muted",
      updatedAt: Timestamp.now(),
    });
    await assertFails(deleteDoc(record(as(SUBSCRIBER))));
    await assertFails(
      setDoc(record(as(SUBSCRIBER)), {
        status: "muted",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("lets a subscriber read their own record only", async () => {
    await seedDoc(["sharedLists", CODE, "subscribers", SUBSCRIBER], {
      status: "muted",
      updatedAt: Timestamp.now(),
    });
    await assertSucceeds(getDoc(record(as(SUBSCRIBER))));
    await assertFails(getDoc(record(as(OTHER), SUBSCRIBER)));
    await assertFails(
      getDocs(collection(as(SUBSCRIBER), "sharedLists", CODE, "subscribers")),
    );
  });

  it.each([
    { status: "member", updatedAt: "now" },
    { status: "muted" },
    { status: "muted", name: "x".repeat(41), updatedAt: "now" },
    { status: "muted", updatedAt: "now", extra: 1 },
  ])("refuses the malformed record %j", async (raw) => {
    const data = {
      ...raw,
      ...("updatedAt" in raw && { updatedAt: serverTimestamp() }),
    };
    await assertFails(setDoc(record(as(PUBLISHER)), data));
  });
});

describe("members-only lists", () => {
  const record = (db: Firestore, uid = SUBSCRIBER) =>
    doc(db, "sharedLists", CODE, "subscribers", uid);
  const listDoc = (db: Firestore) => doc(db, "sharedLists", CODE);

  function membersOnlyList(): SharedListDocument {
    const data = sharedListDoc();
    data.list.membersOnly = true;
    return data;
  }

  const request = (db: Firestore, uid = SUBSCRIBER, name?: string) =>
    setDoc(record(db, uid), {
      membership: "requested",
      ...(name && { name }),
      updatedAt: serverTimestamp(),
    });

  const setMembership = (uid: string, membership: string) =>
    seedDoc(["sharedLists", CODE, "subscribers", uid], {
      membership,
      updatedAt: Timestamp.now(),
    });

  it("accepts publishing a members-only list, and only `true` as the setting", async () => {
    await assertSucceeds(publish(as(PUBLISHER), membersOnlyList()));
    const bad = sharedListDoc();
    (bad.list as unknown as Record<string, unknown>).membersOnly = false;
    await assertFails(publish(as(PUBLISHER), bad));
  });

  it("refuses everyone but members and the owner", async () => {
    await seed(membersOnlyList());
    await setMembership(SUBSCRIBER, "member");
    await setMembership(OTHER, "requested");
    await assertFails(getDoc(listDoc(anonymous())));
    await assertFails(getDoc(listDoc(as(OTHER))));
    await assertFails(getDoc(listDoc(as("stranger-uid"))));
    await assertSucceeds(getDoc(listDoc(as(SUBSCRIBER))));
    await assertSucceeds(getDoc(listDoc(as(PUBLISHER))));
  });

  it("still answers a code that does not exist with not-found", async () => {
    const snap = await assertSucceeds(getDoc(listDoc(as(SUBSCRIBER))));
    expect(snap.exists()).toBe(false);
  });

  it("refuses a declined or removed member", async () => {
    await seed(membersOnlyList());
    await setMembership(SUBSCRIBER, "declined");
    await assertFails(getDoc(listDoc(as(SUBSCRIBER))));
  });

  it("lets a subscriber ask to join, once, for themselves only", async () => {
    await seed(membersOnlyList());
    await assertSucceeds(request(as(SUBSCRIBER), SUBSCRIBER, "Alex"));
    // Asking again, or letting oneself in, is the owner's to answer.
    await assertFails(request(as(SUBSCRIBER)));
    await assertFails(
      setDoc(record(as(SUBSCRIBER)), {
        membership: "member",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(request(as(SUBSCRIBER), OTHER));
    await assertFails(deleteDoc(record(as(SUBSCRIBER))));
  });

  it("refuses a request that lets the subscriber in or carries a mute", async () => {
    await seed(membersOnlyList());
    await assertFails(
      setDoc(record(as(SUBSCRIBER)), {
        membership: "member",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(record(as(SUBSCRIBER)), {
        membership: "requested",
        status: "muted",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("refuses a request to an open list, or one that does not exist", async () => {
    await assertFails(request(as(SUBSCRIBER)));
    await seed(sharedListDoc());
    await assertFails(request(as(SUBSCRIBER)));
  });

  it("refuses a declined subscriber asking again", async () => {
    await seed(membersOnlyList());
    await setMembership(SUBSCRIBER, "declined");
    await assertFails(request(as(SUBSCRIBER)));
  });

  it("lets a muted subscriber ask to join, keeping the mute", async () => {
    await seed(membersOnlyList());
    await seedDoc(["sharedLists", CODE, "subscribers", SUBSCRIBER], {
      status: "muted",
      updatedAt: Timestamp.now(),
    });
    await assertSucceeds(
      setDoc(
        record(as(SUBSCRIBER)),
        { membership: "requested", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
    await assertFails(
      setDoc(record(as(SUBSCRIBER)), {
        membership: "requested",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("lets the owner let in, decline and remove", async () => {
    await seed(membersOnlyList());
    await setMembership(SUBSCRIBER, "requested");
    for (const membership of ["member", "declined", "member"]) {
      await assertSucceeds(
        setDoc(
          record(as(PUBLISHER)),
          { membership, updatedAt: serverTimestamp() },
          { merge: true },
        ),
      );
    }
    await assertSucceeds(deleteDoc(record(as(PUBLISHER))));
  });

  it("lets the owner mute a member without ending the membership", async () => {
    await seed(membersOnlyList());
    await setMembership(SUBSCRIBER, "member");
    await assertSucceeds(
      setDoc(
        record(as(PUBLISHER)),
        { status: "muted", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
    await assertSucceeds(getDoc(listDoc(as(SUBSCRIBER))));
  });

  it.each([
    { membership: "invited", updatedAt: "now" },
    { updatedAt: "now" },
    { membership: "member" },
  ])("refuses the malformed record %j", async (raw) => {
    await seed(membersOnlyList());
    const data = {
      ...raw,
      ...("updatedAt" in raw && { updatedAt: serverTimestamp() }),
    };
    await assertFails(setDoc(record(as(PUBLISHER)), data));
  });

  it("takes suggestions to a members-only list from members only", async () => {
    const data = membersOnlyList();
    data.list.suggestions = { dailyLimit: 2, per: "subscriber" };
    await seed(data);
    await assertFails(suggest(as(OTHER), OTHER, 1));
    await setMembership(SUBSCRIBER, "member");
    await assertSucceeds(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
  });
});

describe("blocked installations (tools/data-removal block-user)", () => {
  const block = (uid: string) =>
    seedDoc(["blockedUsers", uid], { blockedAt: Timestamp.now() });

  it("refuses a blocked id's new list, and its sync of an existing one", async () => {
    await block(PUBLISHER);
    await assertFails(publish(as(PUBLISHER), sharedListDoc()));
    await env.clearFirestore();
    await seed(sharedListDoc());
    await block(PUBLISHER);
    await assertFails(publish(as(PUBLISHER)));
  });

  it("still lets a blocked owner unpublish", async () => {
    await seed(sharedListDoc());
    await block(PUBLISHER);
    await assertSucceeds(
      setDoc(doc(as(PUBLISHER), "sharedListOwners", CODE), owner(PUBLISHER)),
    );
    await assertSucceeds(unpublish(as(PUBLISHER)));
  });

  it("does not let a blocked id take over a list with its key", async () => {
    await seed(sharedListDoc());
    await block("new-phone-uid");
    await assertFails(
      setDoc(
        doc(as("new-phone-uid"), "sharedListOwners", CODE),
        owner("new-phone-uid"),
      ),
    );
  });

  it("refuses a blocked id's suggestions, and no one else's", async () => {
    await seed(listTakingSuggestions());
    await block(SUBSCRIBER);
    await assertFails(suggest(as(SUBSCRIBER), SUBSCRIBER, 1));
    await assertSucceeds(suggest(as(OTHER), OTHER, 1));
  });

  it("refuses a blocked id's request to join", async () => {
    const data = sharedListDoc();
    data.list.membersOnly = true;
    await seed(data);
    await block(SUBSCRIBER);
    await assertFails(
      setDoc(
        doc(as(SUBSCRIBER), "sharedLists", CODE, "subscribers", SUBSCRIBER),
        {
          membership: "requested",
          updatedAt: serverTimestamp(),
        },
      ),
    );
  });

  it("hides the block list from everyone", async () => {
    await block(SUBSCRIBER);
    await assertFails(getDoc(doc(as(SUBSCRIBER), "blockedUsers", SUBSCRIBER)));
  });
});
