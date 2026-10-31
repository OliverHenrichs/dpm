/**
 * The dashboard's own notes on each report, one JSON file per report id:
 * the agent's review, the operator's verdict, the edited email and what was
 * done. They hold reports' personal data (the reporter's email, their words),
 * so they live outside the repository, readable only by the operator, and
 * go when the report goes (PRIVACY_POLICY.md §6: until dealt with).
 *
 * File shape: { reportId, reportCreatedAt, review?, reviewedAt?, costUsd?,
 * failedFor?, error?, decision?: { verdict, note, decidedAt }, email?: {
 * subject, body }, done: [{ action, at }] }
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { looksLikeReportId } = require("./review");

function defaultDir(env = process.env) {
  return (
    env.DPM_REVIEWS_DIR ||
    path.join(os.homedir(), ".local", "share", "dpm", "report-reviews")
  );
}

function reviewStore(dir = defaultDir()) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (id) => {
    if (!looksLikeReportId(id)) throw new Error(`Not a report id: ${id}`);
    return path.join(dir, `${id}.json`);
  };

  return {
    dir,

    /** Every saved review, by report id. */
    all() {
      const out = {};
      for (const name of fs.readdirSync(dir)) {
        const id = name.replace(/\.json$/, "");
        if (!name.endsWith(".json") || !looksLikeReportId(id)) continue;
        try {
          out[id] = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
        } catch {
          // A half-written file: the next save replaces it.
        }
      }
      return out;
    },

    get(id) {
      try {
        return JSON.parse(fs.readFileSync(file(id), "utf8"));
      } catch {
        return undefined;
      }
    },

    /** Merges `changes` into the report's file, written atomically. */
    update(id, changes) {
      const next = { reportId: id, done: [], ...this.get(id), ...changes };
      const tmp = `${file(id)}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
      fs.renameSync(tmp, file(id));
      return next;
    },

    remove(id) {
      fs.rmSync(file(id), { force: true });
    },

    /** Deletes the files of reports that no longer exist. */
    prune(liveIds) {
      const live = new Set(liveIds);
      for (const id of Object.keys(this.all())) {
        if (!live.has(id)) this.remove(id);
      }
    },
  };
}

module.exports = { reviewStore, defaultDir };
