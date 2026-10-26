/**
 * The Data tab: every `npm run data` command on the page (search, show a list
 * or a user, take down, release, remove a user or a suggestion, block,
 * unblock), the cases for erasure requests that come by email, and the action
 * log. Removals use the same plans as the command line and, like it, need
 * what they act on typed back.
 */

const {
  looksLikeShareCode,
  looksLikeUid,
  planUserRemoval,
} = require("../../data-removal/lib/model");
const {
  searchView,
  listView,
  userView,
  takedowns,
  planAction,
} = require("./dataView");
const { looksLikeCaseId } = require("./cases");
const { httpError } = require("./http");

const ACTIONS = [
  "remove-list",
  "release",
  "remove-user",
  "remove-suggestion",
  "block-user",
  "unblock-user",
];

function createData({ store, cases, log }) {
  function shareCode(code) {
    if (!looksLikeShareCode(code)) {
      throw httpError(400, "A share code is 8 characters, 0-9 and A-Z.");
    }
    return code;
  }
  function uid(id) {
    if (!looksLikeUid(id)) throw httpError(400, "Not a user id.");
    return id;
  }

  /** Validates an action request and works out what it will do. */
  async function plan(req) {
    if (!ACTIONS.includes(req.action)) throw httpError(400, "Unknown action.");
    const target = {
      action: req.action,
      code: ["remove-list", "release", "remove-suggestion"].includes(req.action)
        ? shareCode(req.code)
        : undefined,
      uid: ["remove-user", "block-user", "unblock-user"].includes(req.action)
        ? uid(req.uid)
        : undefined,
      suggestionId:
        req.action === "remove-suggestion"
          ? String(req.suggestionId ?? "")
          : undefined,
      allowRepublish: !!req.allowRepublish,
      withLists: !!req.withLists,
    };
    const docs = await store.snapshot({ fresh: true });
    const extra = target.uid
      ? {
          blockedSince: await store.blockedSince(target.uid),
          account: await store.findUser(target.uid),
        }
      : {};
    try {
      return { target, docs, ...planAction(docs, target, extra) };
    } catch (e) {
      throw httpError(400, e.message);
    }
  }

  async function run({ target, docs }) {
    switch (target.action) {
      case "remove-list":
        return store.removeList(target.code, {
          allowRepublish: target.allowRepublish,
        });
      case "release":
        return store.release(target.code);
      case "remove-user": {
        const userPlan = planUserRemoval(docs, target.uid);
        for (const code of userPlan.ownedLists) await store.removeList(code);
        return store.removeUser(userPlan);
      }
      case "remove-suggestion":
        return store.deleteDocs(
          docs.filter(
            (d) =>
              d.kind === "suggestion" &&
              d.code === target.code &&
              d.id === target.suggestionId,
          ),
        );
      case "block-user":
        return store.blockUser(target.uid);
      case "unblock-user":
        return store.unblockUser(target.uid);
    }
  }

  function caseOf(id) {
    if (!looksLikeCaseId(id)) throw httpError(400, "Not a case id.");
    const c = cases.get(id);
    if (!c) throw httpError(404, "No such case.");
    return c;
  }

  const api = {
    "POST /api/data/search": async ({ query }) => {
      const q = String(query ?? "").trim();
      if (q.length < 2)
        throw httpError(400, "Search for at least 2 characters.");
      return searchView(await store.snapshot(), q);
    },

    "POST /api/data/list": async ({ code }) => {
      const view = listView(await store.snapshot(), shareCode(code));
      if (!view) throw httpError(404, `Nothing is stored under ${code}.`);
      return view;
    },

    "POST /api/data/user": async ({ uid: id }) => {
      uid(id);
      const [docs, account, blockedSince] = await Promise.all([
        store.snapshot(),
        store.findUser(id),
        store.blockedSince(id),
      ]);
      return userView(docs, id, { account, blockedSince });
    },

    /** Blocked ids and taken-down codes, so neither is forgotten. */
    "POST /api/data/registry": async () => {
      const [docs, blocks] = await Promise.all([
        store.snapshot(),
        store.blocks(),
      ]);
      return { blocks, takedowns: takedowns(docs) };
    },

    /** What an action will do, for the confirmation screen. Changes nothing. */
    "POST /api/data/plan": async (req) => {
      const { title, effects, expect } = await plan(req);
      return { title, effects, expect };
    },

    "POST /api/data/action": async (req, ctx = {}) => {
      const p = await plan(req);
      if (String(req.confirm ?? "").trim() !== p.expect) {
        throw httpError(400, `Type ${p.expect} to confirm.`);
      }
      const caseId = req.caseId ? caseOf(req.caseId).id : undefined;
      await run(p);
      log.append({
        action: p.target.action,
        shareCode: p.target.code,
        uid: p.target.uid,
        suggestionId: p.target.suggestionId,
        caseId,
        reason: req.reason,
        device: ctx.device,
      });
      if (caseId) {
        cases.record(caseId, p.target.action, p.target.code ?? p.target.uid);
      }
      return { done: p.title.replace(/\?$/, ""), effects: p.effects };
    },

    "GET /api/cases": () => ({ cases: cases.all() }),

    "POST /api/cases/open": ({ from, message }) => {
      if (!String(message ?? "").trim() && !String(from ?? "").trim()) {
        throw httpError(400, "Paste the request or give the sender.");
      }
      return cases.open({ from, message });
    },

    "POST /api/cases/update": ({
      id,
      note,
      reply,
      addTarget,
      removeTarget,
    }) => {
      const c = caseOf(id);
      const changes = {};
      if (note !== undefined) changes.note = String(note);
      if (reply !== undefined) {
        changes.reply = {
          subject: String(reply.subject ?? ""),
          body: String(reply.body ?? ""),
        };
      }
      let targets = c.targets;
      if (addTarget) {
        const t = {
          type: addTarget.type === "user" ? "user" : "list",
          id: String(addTarget.id ?? ""),
        };
        if (t.type === "list") shareCode(t.id);
        else uid(t.id);
        if (!targets.some((x) => x.type === t.type && x.id === t.id)) {
          targets = [...targets, t];
        }
      }
      if (removeTarget) {
        targets = targets.filter(
          (x) => !(x.type === removeTarget.type && x.id === removeTarget.id),
        );
      }
      changes.targets = targets;
      return cases.update(id, changes);
    },

    "POST /api/cases/mark-sent": ({ id }) => {
      caseOf(id);
      return cases.update(id, { replySentAt: new Date().toISOString() });
    },

    /** Deletes the case and its notes; the action log keeps what was done. */
    "POST /api/cases/close": ({ id, confirm }, ctx = {}) => {
      const c = caseOf(id);
      if (confirm !== c.id) throw httpError(400, `Type ${c.id} to confirm.`);
      cases.close(id);
      log.append({ action: "close-case", caseId: id, device: ctx.device });
      return { cases: cases.all() };
    },

    "GET /api/log": () => ({ entries: log.recent() }),
  };

  return { api };
}

/** Routes that delete or block: on the Pi each needs a fresh passkey. */
const DESTRUCTIVE = new Set([
  "POST /api/data/action",
  "POST /api/cases/close",
  "POST /api/action",
]);

module.exports = { createData, DESTRUCTIVE, ACTIONS };
