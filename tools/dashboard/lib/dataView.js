/**
 * The pure half of the Data tab: what a search, a list and a user look like
 * on the page, and what each removal will do, in words. Built on the data
 * removal tool's model (`tools/data-removal/lib/model.js`), so the page and
 * `npm run data` find and plan the same things. No Firebase here.
 */

const {
  TAKEDOWN_OWNER,
  search,
  groupByList,
  fieldLabel,
  docsOfList,
  isTakenDown,
  planListRemoval,
  planUserRemoval,
  looksLikeShareCode,
  looksLikeUid,
} = require("../../data-removal/lib/model");
const { publicList } = require("./review");

const MAX_HITS_PER_LIST = 20;

/** A line about one list: its name, or why there is none. */
function listTitle(docs, code) {
  const list = docs.find((d) => d.kind === "list" && d.code === code);
  if (list) {
    return {
      code,
      name: list.data.list?.name ?? "",
      patterns: list.data.patterns?.length ?? 0,
      status: "live",
    };
  }
  return {
    code,
    name: "",
    patterns: 0,
    status: isTakenDown(docs, code) ? "taken-down" : "leftovers",
  };
}

/**
 * Everything that contains `query`, grouped by list, as `npm run data --
 * find` prints it. A share code or user id is also offered as a direct jump.
 */
function searchView(docs, query) {
  const q = String(query ?? "").trim();
  const groups = groupByList(search(docs, q));
  return {
    query: q,
    shareCode:
      looksLikeShareCode(q) && docsOfList(docs, q).length > 0 ? q : null,
    uid: looksLikeUid(q) ? q : null,
    lists: [...groups].map(([code, hits]) => ({
      ...listTitle(docs, code),
      hits: hits.slice(0, MAX_HITS_PER_LIST).map(({ doc, field, value }) => ({
        kind: doc.kind,
        id: doc.id,
        field: fieldLabel(doc, field),
        value: oneLine(value, 200),
      })),
      more: Math.max(0, hits.length - MAX_HITS_PER_LIST),
    })),
  };
}

/** Everything stored under one share code (`npm run data -- show`). */
function listView(docs, code) {
  const ofList = docsOfList(docs, code);
  if (ofList.length === 0) return null;
  const listDoc = ofList.find((d) => d.kind === "list");
  const owner = ofList.find((d) => d.kind === "owner");
  const takenDown = owner?.data.ownerUid === TAKEDOWN_OWNER;
  return {
    ...listTitle(docs, code),
    ownerUid: owner && !takenDown ? String(owner.data.ownerUid) : null,
    removedAt: takenDown ? (owner.data.removedAt ?? null) : null,
    list: listDoc ? publicList(listDoc.data) : null,
    suggestions: ofList
      .filter((d) => d.kind === "suggestion")
      .map((d) => ({
        id: d.id,
        name: d.data.pattern?.name ?? "",
        kind: d.data.kind ?? "new",
        authorName: d.data.authorName ?? "",
        authorUid: d.data.authorUid ?? null,
        createdAt: d.data.createdAt ?? null,
      })),
    subscribers: ofList
      .filter((d) => d.kind === "subscriber")
      .map((d) => ({
        uid: d.id,
        name: d.data.name ?? "",
        membership: d.data.membership ?? "",
        status: d.data.status ?? "",
      })),
    counters: ofList.filter((d) => d.kind === "counter").length,
    handovers: ofList.filter((d) => d.kind === "handover").length,
    reports: ofList
      .filter((d) => d.kind === "report")
      .map((d) => ({
        id: d.id,
        reason: d.data.reason,
        createdAt: d.data.createdAt ?? null,
      })),
  };
}

/** Where one anonymous user id appears, and its sign-in account. */
function userView(docs, uid, { account = null, blockedSince = null } = {}) {
  const plan = planUserRemoval(docs, uid);
  const name = (code) => listTitle(docs, code).name;
  return {
    uid,
    account,
    blockedSince,
    ownedLists: plan.ownedLists.map((code) => listTitle(docs, code)),
    suggestions: plan.deletes
      .filter((d) => d.kind === "suggestion")
      .map((d) => ({
        code: d.code,
        listName: name(d.code),
        id: d.id,
        name: d.data.pattern?.name ?? "",
      })),
    memberships: plan.deletes
      .filter((d) => d.kind === "subscriber")
      .map((d) => ({
        code: d.code,
        listName: name(d.code),
        name: d.data.name ?? "",
        membership: d.data.membership ?? "",
        status: d.data.status ?? "",
      })),
    reportsSent: plan.deletes.filter((d) => d.kind === "report").length,
    documents: plan.deletes.length,
  };
}

/** Every taken-down share code, oldest first. */
function takedowns(docs) {
  return docs
    .filter((d) => d.kind === "owner" && d.data.ownerUid === TAKEDOWN_OWNER)
    .map((d) => ({ code: d.code, removedAt: d.data.removedAt ?? null }))
    .sort((a, b) =>
      String(a.removedAt ?? "").localeCompare(String(b.removedAt ?? "")),
    );
}

/** How a document is counted: singular, plural, and whether it is the only one. */
const WORDS = {
  list: ["the list document"],
  owner: ["the owner record"],
  suggestion: ["suggestion", "suggestions"],
  subscriber: ["subscriber record", "subscriber records"],
  counter: ["daily counter", "daily counters"],
  handover: ["handover offer", "handover offers"],
  report: ["report", "reports"],
};

function describeDoc(doc) {
  if (doc.kind === "suggestion") {
    return `suggestion "${doc.data.pattern?.name ?? doc.id}"`;
  }
  return WORDS[doc.kind][0];
}

/** Counts like "the list document, 2 suggestions, 1 subscriber record". */
function tally(docs) {
  const counts = new Map();
  for (const d of docs) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => {
    const [one, many] = WORDS[kind];
    if (!many) return one;
    return n === 1 ? `1 ${one}` : `${n} ${many}`;
  });
}

/**
 * What a Data tab action will do, in words, and what must be typed back to
 * confirm it, before anything changes. Throws a message for the page when the
 * action cannot be done, as the command line refuses it.
 *
 * @returns {{ title: string, effects: string[], expect: string }}
 */
function planAction(docs, req, { blockedSince = null, account = null } = {}) {
  const { action, code, uid, suggestionId } = req;
  switch (action) {
    case "remove-list": {
      const plan = planListRemoval(docs, code, {
        allowRepublish: !!req.allowRepublish,
      });
      if (!plan.exists && plan.deletes.length === 0) {
        throw new Error(
          isTakenDown(docs, code)
            ? `${code} is already taken down.`
            : `Nothing is stored under ${code}.`,
        );
      }
      const { name } = listTitle(docs, code);
      return {
        title: `Take down ${name ? `"${name}" (${code})` : code}?`,
        effects: [
          `Deletes ${tally(plan.deletes).join(", ") || "nothing else"}`,
          plan.takedown
            ? "Leaves a takedown record, so the owner's phone can't publish this code again"
            : "Deletes the owner record: the owner's next edit publishes the list again",
          "Keeps the reports about it; subscribers keep their own copy",
        ],
        expect: code,
      };
    }
    case "release":
      if (!isTakenDown(docs, code))
        throw new Error(`${code} is not taken down.`);
      return {
        title: `Release the takedown of ${code}?`,
        effects: [
          "Deletes the takedown record",
          "The owner's phone publishes the list again with its next edit",
        ],
        expect: code,
      };
    case "remove-user": {
      const plan = planUserRemoval(docs, uid);
      if (plan.ownedLists.length > 0 && !req.withLists) {
        throw new Error(
          `${uid} owns ${plan.ownedLists.join(", ")}. Tick "with their lists" to take those down too.`,
        );
      }
      if (
        !account &&
        plan.deletes.length === 0 &&
        plan.ownedLists.length === 0
      ) {
        throw new Error(`Nothing is stored for ${uid}.`);
      }
      return {
        title: `Remove everything of ${uid}?`,
        effects: [
          ...plan.ownedLists.map((c) => `Takes down list ${c}`),
          plan.deletes.length
            ? `Deletes ${tally(plan.deletes).join(", ")}`
            : "No suggestions, memberships or reports to delete",
          account
            ? "Deletes the sign-in account"
            : "There is no sign-in account to delete",
          ...(blockedSince
            ? ["Lifts the block: the phone signs in with a new id anyway"]
            : []),
        ],
        expect: uid,
      };
    }
    case "remove-suggestion": {
      const doc = docs.find(
        (d) =>
          d.kind === "suggestion" && d.code === code && d.id === suggestionId,
      );
      if (!doc) throw new Error(`No suggestion ${suggestionId} under ${code}.`);
      return {
        title: `Delete ${describeDoc(doc)} on ${code}?`,
        effects: [
          `By ${doc.data.authorName || "(no name)"}; the rest of the list stays`,
        ],
        expect: suggestionId,
      };
    }
    case "block-user":
      if (blockedSince) throw new Error(`${uid} is already blocked.`);
      return {
        title: `Block ${uid}?`,
        effects: [
          "The rules refuse its publishing, suggesting and asking to join",
          "Its lists stay; take them down separately",
          "A reinstall gets a new id, which this does not cover",
        ],
        expect: uid,
      };
    case "unblock-user":
      if (!blockedSince) throw new Error(`${uid} is not blocked.`);
      return {
        title: `Unblock ${uid}?`,
        effects: ["It can publish, suggest and ask to join again"],
        expect: uid,
      };
    default:
      throw new Error("Unknown action.");
  }
}

function oneLine(text, max) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

module.exports = {
  searchView,
  listView,
  userView,
  takedowns,
  planAction,
};
