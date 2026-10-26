/**
 * What the operator removed or blocked, when, from which device and why: one
 * JSON line per action. It names share codes, user ids and report or case
 * ids, never list content, an email address or a reporter's words, so a
 * publisher who asks why their list went can be answered after the report is
 * deleted. Kept for two years (PRIVACY_POLICY.md §6); older lines are dropped
 * when the dashboard starts.
 */

const fs = require("fs");
const { now } = require("./http");

const KEEP_DAYS = 730;
const FIELDS = [
  "action",
  "shareCode",
  "uid",
  "suggestionId",
  "reportId",
  "caseId",
  "reason",
  "device",
];

function actionLog(file, { keepDays = KEEP_DAYS } = {}) {
  const read = () => {
    try {
      return fs
        .readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        });
    } catch {
      return [];
    }
  };

  return {
    file,

    append(entry) {
      const line = { at: now() };
      for (const k of FIELDS) {
        if (entry[k] !== undefined && entry[k] !== null && entry[k] !== "") {
          line[k] = String(entry[k]).slice(0, 500);
        }
      }
      fs.appendFileSync(file, `${JSON.stringify(line)}\n`, { mode: 0o600 });
      return line;
    },

    /** Newest first. */
    recent(limit = 200) {
      return read().reverse().slice(0, limit);
    },

    prune(at = Date.now()) {
      const cutoff = new Date(at - keepDays * 86_400_000).toISOString();
      const all = read();
      const kept = all.filter((e) => String(e.at) >= cutoff);
      if (kept.length === all.length) return 0;
      fs.writeFileSync(
        file,
        kept.map((e) => `${JSON.stringify(e)}\n`).join(""),
        {
          mode: 0o600,
        },
      );
      return all.length - kept.length;
    },
  };
}

module.exports = { actionLog, KEEP_DAYS };
