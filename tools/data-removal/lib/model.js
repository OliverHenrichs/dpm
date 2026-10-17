/**
 * The pure half of the data removal tool: searching a snapshot of the shared
 * data and planning what a removal deletes. No Firebase here, so the unit
 * tests can run it (`__tests__/unit/dataRemoval.test.js`); `firestore.js`
 * loads the snapshot and carries out the plans.
 *
 * A snapshot is every document the app writes to Firestore, as plain values:
 * the shared lists, their owner records, and the three subcollections under a
 * list (`src/firebase/AGENTS.md`).
 */

const LISTS = "sharedLists";
const OWNERS = "sharedListOwners";
const SUGGESTIONS = "suggestions";
const COUNTERS = "suggestionCounters";
const SUBSCRIBERS = "subscribers";

/**
 * What an owner record names as owner after a takedown. Firebase user ids are
 * letters and digits only, so no device can ever be this owner: the rules
 * then refuse the publisher's phone when it pushes the list again.
 */
const TAKEDOWN_OWNER = "removed-by-operator";

/** Secrets: never printed, never searched. */
const SECRET_FIELDS = new Set(["key", "appToken"]);

/**
 * @typedef {"list" | "owner" | "suggestion" | "counter" | "subscriber"} DocKind
 * @typedef {{ kind: DocKind, path: string, code: string, id: string, data: Record<string, unknown> }} Doc
 * @typedef {{ doc: Doc, field: string, value: string }} Hit
 */

/** The kind of document at a Firestore path, and the share code it belongs to. */
function describePath(path) {
  const parts = path.split("/");
  if (parts[0] === LISTS && parts.length === 2) {
    return { kind: "list", code: parts[1], id: parts[1] };
  }
  if (parts[0] === OWNERS && parts.length === 2) {
    return { kind: "owner", code: parts[1], id: parts[1] };
  }
  if (parts[0] === LISTS && parts.length === 4) {
    const kind = {
      [SUGGESTIONS]: "suggestion",
      [COUNTERS]: "counter",
      [SUBSCRIBERS]: "subscriber",
    }[parts[2]];
    if (kind) return { kind, code: parts[1], id: parts[3] };
  }
  return null;
}

/** @returns {Doc} */
function makeDoc(path, data) {
  const where = describePath(path);
  if (!where) throw new Error(`Not a document the app writes: ${path}`);
  return { ...where, path, data };
}

/** Every string in a document, with where it sits, secrets left out. */
function* strings(value, field = "") {
  if (typeof value === "string") {
    yield { field, value };
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      yield* strings(value[i], `${field}[${i}]`);
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_FIELDS.has(k)) continue;
      yield* strings(v, field ? `${field}.${k}` : k);
    }
  }
}

/**
 * Every document whose id or any text contains `query`, ignoring case: a share
 * code, a user id, a name, a word from a description, part of a video link.
 *
 * @param {Doc[]} docs
 * @param {string} query
 * @returns {Hit[]}
 */
function search(docs, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits = [];
  for (const doc of docs) {
    if (doc.id.toLowerCase().includes(needle)) {
      hits.push({ doc, field: "(document id)", value: doc.id });
    }
    for (const { field, value } of strings(doc.data)) {
      if (value.toLowerCase().includes(needle)) {
        hits.push({ doc, field, value });
      }
    }
  }
  return hits;
}

/** Hits grouped by the shared list they belong to, in share code order. */
function groupByList(hits) {
  const groups = new Map();
  for (const hit of hits) {
    const group = groups.get(hit.doc.code) ?? [];
    group.push(hit);
    groups.set(hit.doc.code, group);
  }
  return new Map([...groups].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * A field path as a person reads it: `patterns[3].videoRefs[0].value` becomes
 * `pattern "Whip" › videoRefs[0].value`.
 */
function fieldLabel(doc, field) {
  const m = /^patterns\[(\d+)\](?:\.(.*))?$/.exec(field);
  if (doc.kind === "list" && m) {
    const pattern = doc.data.patterns?.[Number(m[1])];
    const name = pattern?.name ?? `#${m[1]}`;
    return `pattern "${name}"${m[2] ? ` › ${m[2]}` : ""}`;
  }
  const mod = /^list\.modifiers\[(\d+)\](?:\.(.*))?$/.exec(field);
  if (doc.kind === "list" && mod) {
    const modifier = doc.data.list?.modifiers?.[Number(mod[1])];
    const name = modifier?.name ?? `#${mod[1]}`;
    return `modifier "${name}"${mod[2] ? ` › ${mod[2]}` : ""}`;
  }
  return field;
}

/** Everything stored under one share code. */
function docsOfList(docs, code) {
  return docs.filter((d) => d.code === code);
}

function isTakenDown(docs, code) {
  return docs.some(
    (d) =>
      d.kind === "owner" &&
      d.code === code &&
      d.data.ownerUid === TAKEDOWN_OWNER,
  );
}

/**
 * Removing a shared list: the list, everything under it, and its owner record,
 * which is replaced by a takedown record unless `allowRepublish`. Without the
 * takedown the publisher's phone would put the list back with its next edit,
 * since every edit re-publishes the whole list.
 *
 * @returns {{ code: string, deletes: Doc[], takedown: boolean, ownerUid: string | null, exists: boolean }}
 */
function planListRemoval(docs, code, { allowRepublish = false } = {}) {
  const ofList = docsOfList(docs, code);
  const owner = ofList.find((d) => d.kind === "owner");
  const ownerUid =
    owner && owner.data.ownerUid !== TAKEDOWN_OWNER
      ? String(owner.data.ownerUid)
      : null;
  return {
    code,
    exists: ofList.some((d) => d.kind === "list"),
    deletes: ofList.filter((d) => d.kind !== "owner" || allowRepublish),
    takedown: !allowRepublish,
    ownerUid,
  };
}

/**
 * Removing what one anonymous user id left: their suggestions, their
 * subscriber records (join requests, mutes, the name they gave), their own
 * daily counters, and their Firebase Authentication account. Lists they
 * publish are named in `ownedLists`; their owner records hold the id, so the
 * tool removes those lists too, or nothing, never just the account.
 */
function planUserRemoval(docs, uid) {
  const deletes = docs.filter(
    (d) =>
      (d.kind === "suggestion" && d.data.authorUid === uid) ||
      (d.kind === "subscriber" && d.id === uid) ||
      (d.kind === "counter" && d.id.endsWith(`_${uid}`)),
  );
  const ownedLists = docs
    .filter((d) => d.kind === "owner" && d.data.ownerUid === uid)
    .map((d) => d.code);
  return { uid, deletes, ownedLists };
}

/** Whether a query could be a share code: 8 characters, 0-9 and A-Z. */
function looksLikeShareCode(query) {
  return /^[0-9A-Z]{8}$/.test(query);
}

/** Whether a query could be a Firebase user id (anonymous ids are 28 characters). */
function looksLikeUid(query) {
  return /^[A-Za-z0-9]{20,128}$/.test(query);
}

module.exports = {
  LISTS,
  OWNERS,
  SUGGESTIONS,
  COUNTERS,
  SUBSCRIBERS,
  TAKEDOWN_OWNER,
  describePath,
  makeDoc,
  search,
  groupByList,
  fieldLabel,
  docsOfList,
  isTakenDown,
  planListRemoval,
  planUserRemoval,
  looksLikeShareCode,
  looksLikeUid,
};
