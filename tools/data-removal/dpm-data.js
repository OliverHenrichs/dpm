#!/usr/bin/env node
/**
 * Finds and removes what people published through DPM's cloud sharing, for
 * erasure requests and content that must not be there (a child's data, for
 * one: PRIVACY_POLICY.md §7, §8). Run from the repository root with
 * `npm run data -- <command>`; see tools/data-removal/README.md.
 */

const readline = require("readline/promises");
const {
  TAKEDOWN_OWNER,
  describeSuggestion,
  search,
  groupByList,
  fieldLabel,
  docsOfList,
  isTakenDown,
  planListRemoval,
  planUserRemoval,
  reportsOf,
  looksLikeShareCode,
  looksLikeUid,
} = require("./lib/model");
const store = require("./lib/firestore");

const USAGE = `Usage: npm run data -- <command> [options]

  find <text>                   Search every shared list, suggestion and subscriber
                                record for <text>: a share code, a user id, a name,
                                a word, part of a video link. Case is ignored.
  show <shareCode>              Everything stored under one shared list.
  remove-list <shareCode>       Delete a shared list with its suggestions and
                                subscriber records, and block its publisher's phone
                                from putting it back.
      --allow-republish         Delete without blocking: the publisher's next edit
                                publishes the list again.
  remove-user <uid>             Delete one anonymous user's suggestions, subscriber
                                records, counters and reports, and their sign-in
                                account.
      --with-lists              Also remove the lists they publish (required when
                                they publish any).
  remove-suggestion <shareCode> <suggestionId>
                                Delete one suggestion.
  reports                       Every report about a list, newest first.
  remove-report <reportId>      Delete one report once it is dealt with
                                (<reportId> is <shareCode>_<reporter uid>).
  release <shareCode>           Undo a takedown, so the publisher can publish again.
  block-user <uid>              Stop that installation publishing, suggesting or asking
                                to join, until the app is reinstalled. Its lists stay;
                                remove them with remove-list.
  unblock-user <uid>            Lift a block.

  --yes                         Do not ask before deleting.
  --dry-run                     Show what would be deleted, delete nothing.`;

function parseArgs(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const args = argv.filter((a) => !a.startsWith("--"));
  return { command: args[0], args: args.slice(1), flags };
}

function oneLine(text, max = 100) {
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function listTitle(docs, code) {
  const list = docs.find((d) => d.kind === "list" && d.code === code);
  if (list) {
    const n = list.data.patterns?.length ?? 0;
    return `${code}  "${list.data.list?.name}" (${n} patterns, published ${list.data.publishedAt})`;
  }
  return isTakenDown(docs, code)
    ? `${code}  (taken down)`
    : `${code}  (no list: leftovers only)`;
}

function printDoc(doc) {
  switch (doc.kind) {
    case "list":
      return `list document (${doc.data.patterns?.length ?? 0} patterns)`;
    case "owner":
      return doc.data.ownerUid === TAKEDOWN_OWNER
        ? `takedown record (removed ${doc.data.removedAt})`
        : `owner record (owner ${doc.data.ownerUid})`;
    case "suggestion":
      return `suggestion ${doc.id}: ${describeSuggestion(doc.data)} by ${doc.data.authorName ?? "(no name)"} [${doc.data.authorUid}]`;
    case "subscriber":
      return `subscriber ${doc.id}: ${[doc.data.name && `"${doc.data.name}"`, doc.data.membership, doc.data.status].filter(Boolean).join(", ")}`;
    case "counter":
      return `daily counter ${doc.id}`;
    case "handover":
      return `handover offer ${doc.id}`;
    case "report":
      return `report ${doc.id}: ${doc.data.reason}, ${doc.data.createdAt}${doc.data.contact ? `, reply to ${doc.data.contact}` : ""}${doc.data.details ? `\n      "${oneLine(doc.data.details, 300)}"` : ""}`;
  }
}

async function confirm(flags, what, expected) {
  if (flags.has("--yes")) return true;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    `\nThis deletes ${what} for good. Type ${expected} to go ahead: `,
  );
  rl.close();
  return answer.trim() === expected;
}

async function find(conn, docs, query) {
  if (looksLikeShareCode(query) && docsOfList(docs, query).length > 0) {
    show(docs, query);
    return;
  }
  const groups = groupByList(search(docs, query));
  if (groups.size === 0) {
    console.log(`Nothing in Firestore contains "${query}".`);
  }
  for (const [code, hits] of groups) {
    console.log(`\n${listTitle(docs, code)}`);
    for (const { doc, field, value } of hits.slice(0, 20)) {
      const where = doc.kind === "list" ? "" : `${doc.kind} ${doc.id} › `;
      console.log(`  ${where}${fieldLabel(doc, field)}: ${oneLine(value)}`);
    }
    if (hits.length > 20) console.log(`  … and ${hits.length - 20} more`);
  }
  if (looksLikeUid(query)) {
    const blocked = await store.blockedSince(conn.db, query);
    if (blocked) console.log(`\n${query} is blocked since ${blocked}.`);
    const user = await store.findUser(conn.auth, query);
    if (user) {
      console.log(
        `\nSign-in account ${user.uid}: created ${user.created}, last signed in ${user.lastSignIn}`,
      );
      const plan = planUserRemoval(docs, query);
      console.log(
        `  publishes ${plan.ownedLists.join(", ") || "no lists"}; ${plan.deletes.length} suggestion/subscriber documents`,
      );
    }
  }
  if (groups.size > 0) {
    console.log(
      `\n${groups.size} list(s). \`show <shareCode>\` for everything under one.`,
    );
  }
}

function show(docs, code) {
  const ofList = docsOfList(docs, code);
  if (ofList.length === 0) {
    console.log(`Nothing is stored under ${code}.`);
    return;
  }
  console.log(listTitle(docs, code));
  const listDoc = ofList.find((d) => d.kind === "list");
  if (listDoc) {
    const { list, patterns = [] } = listDoc.data;
    if (list.description)
      console.log(`  description: ${oneLine(list.description, 200)}`);
    if (list.membersOnly) console.log("  members only");
    for (const m of list.modifiers ?? []) {
      const videos = (m.videoRefs ?? []).map((v) => v.value).join(" ");
      console.log(`  modifier "${m.name}"${videos && ` ${videos}`}`);
    }
    for (const p of patterns) {
      const videos = [
        ...(p.videoRefs ?? []),
        ...(p.modifierRefs ?? []).flatMap((r) => r.videoRefs ?? []),
      ].map((v) => v.value);
      console.log(`  #${p.id} "${p.name}"`);
      if (p.description)
        console.log(`      description: ${oneLine(p.description, 200)}`);
      if (p.tags?.length) console.log(`      tags: ${p.tags.join(", ")}`);
      for (const url of videos) console.log(`      video: ${url}`);
    }
  }
  for (const doc of ofList.filter((d) => d.kind !== "list")) {
    console.log(`  ${printDoc(doc)}`);
  }
}

async function removeList(conn, docs, code, flags) {
  const plan = planListRemoval(docs, code, {
    allowRepublish: flags.has("--allow-republish"),
  });
  if (plan.deletes.length === 0 && !plan.exists) {
    console.log(
      isTakenDown(docs, code)
        ? `${code} is already taken down.`
        : `Nothing is stored under ${code}.`,
    );
    return;
  }
  console.log(`Removing ${listTitle(docs, code)}:`);
  plan.deletes.forEach((d) => console.log(`  delete ${printDoc(d)}`));
  console.log(
    plan.takedown
      ? `  replace the owner record with a takedown record: the publisher's phone cannot publish under ${code} again`
      : `  delete the owner record: the publisher's next edit publishes the list again`,
  );
  if (plan.ownerUid) {
    console.log(
      `Publisher: ${plan.ownerUid} (\`block-user ${plan.ownerUid}\` keeps that phone from publishing again)`,
    );
  }
  if (flags.has("--dry-run")) return;
  if (!(await confirm(flags, `list ${code}`, code))) {
    console.log("Nothing deleted.");
    return;
  }
  await store.removeList(conn, plan);
  console.log(`Removed ${code}.`);
}

async function removeUser(conn, docs, uid, flags) {
  const plan = planUserRemoval(docs, uid);
  const user = await store.findUser(conn.auth, uid);
  if (plan.ownedLists.length > 0 && !flags.has("--with-lists")) {
    console.log(
      `${uid} publishes ${plan.ownedLists.join(", ")}. Their owner records hold the id, so add --with-lists to remove those lists too.`,
    );
    process.exitCode = 1;
    return;
  }
  const listPlans = plan.ownedLists.map((code) => planListRemoval(docs, code));
  if (!user && plan.deletes.length === 0 && listPlans.length === 0) {
    console.log(`Nothing is stored for ${uid}.`);
    return;
  }
  console.log(`Removing user ${uid}:`);
  for (const lp of listPlans) {
    console.log(`  remove list ${listTitle(docs, lp.code)} (taken down)`);
  }
  plan.deletes.forEach((d) =>
    console.log(`  delete ${d.code} › ${printDoc(d)}`),
  );
  console.log(
    user
      ? `  delete the sign-in account (created ${user.created})`
      : "  (no sign-in account)",
  );
  if (await store.blockedSince(conn.db, uid)) {
    console.log(
      "  delete its block: with the account gone, the phone signs in with a new id anyway",
    );
  }
  if (flags.has("--dry-run")) return;
  if (!(await confirm(flags, `everything of ${uid}`, uid))) {
    console.log("Nothing deleted.");
    return;
  }
  for (const lp of listPlans) await store.removeList(conn, lp);
  await store.removeUser(conn, plan);
  console.log(`Removed ${uid}.`);
}

async function removeSuggestion(conn, docs, code, id, flags) {
  const doc = docs.find(
    (d) => d.kind === "suggestion" && d.code === code && d.id === id,
  );
  if (!doc) {
    console.log(`No suggestion ${id} under ${code}.`);
    return;
  }
  console.log(`Removing ${printDoc(doc)}`);
  if (flags.has("--dry-run")) return;
  if (!(await confirm(flags, `this suggestion`, id))) {
    console.log("Nothing deleted.");
    return;
  }
  await store.deleteDocs(conn.db, [doc]);
  console.log("Removed.");
}

function reports(docs) {
  const all = reportsOf(docs);
  if (all.length === 0) {
    console.log("No reports.");
    return;
  }
  for (const doc of all) {
    console.log(`\n${listTitle(docs, doc.code)}`);
    console.log(`  ${printDoc(doc)}`);
  }
  console.log(
    `\n${all.length} report(s). \`show <shareCode>\` for the list, \`remove-list\` to take it down, \`remove-report <reportId>\` once dealt with.`,
  );
}

async function removeReport(conn, docs, id, flags) {
  const doc = docs.find((d) => d.kind === "report" && d.id === id);
  if (!doc) {
    console.log(`No report ${id ?? ""}.`);
    return;
  }
  console.log(`Removing ${printDoc(doc)}`);
  if (flags.has("--dry-run")) return;
  if (!(await confirm(flags, "this report", id))) {
    console.log("Nothing deleted.");
    return;
  }
  await store.deleteDocs(conn.db, [doc]);
  console.log("Removed.");
}

async function release(conn, docs, code, flags) {
  if (!isTakenDown(docs, code)) {
    console.log(`${code} is not taken down.`);
    return;
  }
  console.log(
    `Releasing ${code}: the publisher's phone can publish the list again with its next edit.`,
  );
  if (flags.has("--dry-run")) return;
  if (!(await confirm(flags, `the takedown of ${code}`, code))) {
    console.log("Nothing changed.");
    return;
  }
  await store.releaseTakedown(conn, code);
  console.log("Released.");
}

async function block(conn, uid, flags, unblock) {
  const since = await store.blockedSince(conn.db, uid);
  if (unblock) {
    if (!since) {
      console.log(`${uid} is not blocked.`);
      return;
    }
    if (flags.has("--dry-run")) return;
    await store.unblockUser(conn, uid);
    console.log(`Unblocked ${uid}.`);
    return;
  }
  if (since) {
    console.log(`${uid} is already blocked (since ${since}).`);
    return;
  }
  if (!(await store.findUser(conn.auth, uid))) {
    console.log(`Note: ${uid} has no sign-in account; blocking it anyway.`);
  }
  console.log(
    `Blocking ${uid}: the rules will refuse its publishing, suggesting and asking to join. Reinstalling the app gets a new id, which this does not cover.`,
  );
  if (flags.has("--dry-run")) return;
  await store.blockUser(conn, uid);
  console.log(`Blocked ${uid}.`);
}

function requireUid(uid) {
  if (!uid || !looksLikeUid(uid)) {
    throw new Error(`"${uid ?? ""}" is not a user id.`);
  }
  return uid;
}

function requireShareCode(code) {
  if (!code || !looksLikeShareCode(code)) {
    throw new Error(
      `"${code ?? ""}" is not a share code (8 characters, 0-9 and A-Z).`,
    );
  }
  return code;
}

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));
  const commands = [
    "find",
    "show",
    "remove-list",
    "remove-user",
    "remove-suggestion",
    "reports",
    "remove-report",
    "release",
    "block-user",
    "unblock-user",
  ];
  if (!commands.includes(command) || (command === "find" && !args[0])) {
    console.log(USAGE);
    process.exitCode = command ? 1 : 0;
    return;
  }
  const conn = store.connect();
  console.log(
    `Project ${conn.projectId}${conn.emulated ? " (emulator)" : ""}\n`,
  );
  const docs = await store.loadSnapshot(conn.db);
  switch (command) {
    case "find":
      return find(conn, docs, args.join(" "));
    case "show":
      return show(docs, requireShareCode(args[0]));
    case "remove-list":
      return removeList(conn, docs, requireShareCode(args[0]), flags);
    case "remove-user":
      return removeUser(conn, docs, requireUid(args[0]), flags);
    case "remove-suggestion":
      return removeSuggestion(
        conn,
        docs,
        requireShareCode(args[0]),
        args[1],
        flags,
      );
    case "reports":
      return reports(docs);
    case "remove-report":
      return removeReport(conn, docs, args[0], flags);
    case "release":
      return release(conn, docs, requireShareCode(args[0]), flags);
    case "block-user":
      return block(conn, requireUid(args[0]), flags, false);
    case "unblock-user":
      return block(conn, requireUid(args[0]), flags, true);
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exitCode = 1;
});
