/**
 * Erasure requests and other cases that arrive by email (PRIVACY_POLICY.md
 * §7), one JSON file per case: who asked and what, the operator's note, the
 * lists and user ids found for it, what was removed, and the reply. They hold
 * the requester's email and words, so they live outside the repository,
 * readable only by the operator, and are deleted when the case is closed
 * (§6). The action log keeps what was removed, without them.
 *
 * File shape: { id, openedAt, from, message, note, targets: [{ type: "list" |
 * "user", id }], reply: { subject, body }, done: [{ action, target, at }],
 * replySentAt }
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { now, readJson, writeJson } = require("./http");

const CASE_ID = /^c[0-9a-z]{8,40}$/;

function looksLikeCaseId(id) {
  return typeof id === "string" && CASE_ID.test(id);
}

/** open: nothing done yet · acted: something removed · replied: reply marked sent. */
function caseStage(c) {
  if (c.replySentAt) return "replied";
  return c.done?.length ? "acted" : "open";
}

function caseStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (id) => {
    if (!looksLikeCaseId(id)) throw new Error(`Not a case id: ${id}`);
    return path.join(dir, `${id}.json`);
  };

  return {
    dir,

    /** Every open case, oldest first. */
    all() {
      return fs
        .readdirSync(dir)
        .filter((n) => n.endsWith(".json"))
        .map((n) => readJson(path.join(dir, n)))
        .filter((c) => c && looksLikeCaseId(c.id))
        .map((c) => ({ ...c, stage: caseStage(c) }))
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    },

    get(id) {
      const c = readJson(file(id));
      return c && { ...c, stage: caseStage(c) };
    },

    open({ from, message }) {
      const id = `c${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
      const c = {
        id,
        openedAt: now(),
        from: String(from ?? "").trim(),
        message: String(message ?? ""),
        note: "",
        targets: [],
        reply: {
          subject: "Your request to delete your data from DancePatternMapper",
          body: "",
        },
        done: [],
        replySentAt: null,
      };
      writeJson(file(id), c);
      return c;
    },

    update(id, changes) {
      const before = readJson(file(id));
      if (!before) throw new Error("No such case.");
      const next = { ...before, ...changes, id };
      writeJson(file(id), next);
      return { ...next, stage: caseStage(next) };
    },

    record(id, action, target) {
      const c = readJson(file(id));
      if (!c) return;
      this.update(id, { done: [...c.done, { action, target, at: now() }] });
    },

    close(id) {
      fs.rmSync(file(id), { force: true });
    },
  };
}

module.exports = { caseStore, caseStage, looksLikeCaseId };
