// Compares `npm audit --json` (path in argv, default audit.json) against the
// advisories we have reviewed and accepted. Any advisory not listed here fails
// the check, whatever its severity; an accepted one that no longer appears is
// reported so its entry can be removed. Keep this list and AGENTS.md in step.
//
// Every acceptance expires: past `until` (a UTC date) the advisory fails the
// check again, so it is re-reviewed rather than accepted indefinitely. Check
// whether a fix has shipped; if not, set a new date. Within WARN_DAYS of the
// date the check passes with a warning.
const fs = require("fs");

const ACCEPTED = {
  // expo-router -> query-string@7 -> decode-uri-component. The fix is ESM-only
  // and cannot be forced under a CJS parent; waits for expo-router upstream.
  "GHSA-vcc3-ghjq-m6fr": { name: "decode-uri-component", until: "2026-11-01" },
  // expo -> @expo/cli (and @expo/code-signing-certificates) -> node-forge.
  // Dev tooling only (EAS update code signing), never in the app bundle.
  // No patched release exists (1.4.0 is the latest and is affected).
  "GHSA-86w9-cpqp-85rv": { name: "node-forge", until: "2026-11-01" },
  // micromatch -> braces, under metro, jest and @expo/cli. Dev tooling only;
  // the glob patterns come from our own config, not from untrusted input.
  // No patched release exists (3.0.3 is the latest and is affected).
  "GHSA-vfj7-8cjw-p6xm": { name: "braces", until: "2026-11-01" },
};

const WARN_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const audit = JSON.parse(
  fs.readFileSync(process.argv[2] || "audit.json", "utf8"),
);

const found = new Map();
for (const vuln of Object.values(audit.vulnerabilities || {})) {
  for (const via of vuln.via) {
    if (typeof via === "string") continue;
    const id = via.url.split("/").pop();
    found.set(id, `${via.name} (${via.severity}) ${via.title}`);
  }
}

const now = Date.now();
const daysLeft = (id) =>
  Math.ceil((Date.parse(`${ACCEPTED[id].until}T23:59:59Z`) - now) / DAY_MS);

const unexpected = [...found].filter(([id]) => !(id in ACCEPTED));
const expired = [...found].filter(
  ([id]) => id in ACCEPTED && !(daysLeft(id) > 0),
);
const expiring = [...found].filter(
  ([id]) => id in ACCEPTED && daysLeft(id) > 0 && daysLeft(id) <= WARN_DAYS,
);
const resolved = Object.keys(ACCEPTED).filter((id) => !found.has(id));

console.log("npm audit counts:", audit.metadata.vulnerabilities);
for (const id of resolved) {
  console.log(
    `::warning::${id} (${ACCEPTED[id].name}) no longer reported; remove it from scripts/check-audit.js and AGENTS.md`,
  );
}
for (const [id] of expiring) {
  console.log(
    `::warning::Acceptance of ${id} (${ACCEPTED[id].name}) expires on ${ACCEPTED[id].until}; re-review it`,
  );
}
let failed = false;
if (expired.length > 0) {
  console.error("Accepted advisories whose review date has passed:");
  for (const [id, desc] of expired) {
    console.error(`  ${id}: ${desc} (accepted until ${ACCEPTED[id].until})`);
  }
  console.error(
    "Re-review them: fix them if a patched release exists, otherwise set a new `until` in scripts/check-audit.js.",
  );
  failed = true;
}
if (unexpected.length > 0) {
  console.error(
    "npm audit reports advisories that are not in the accepted list:",
  );
  for (const [id, desc] of unexpected) console.error(`  ${id}: ${desc}`);
  console.error(
    "Fix them (an override in package.json), or review and add them to ACCEPTED in scripts/check-audit.js and to AGENTS.md.",
  );
  failed = true;
}
if (failed) process.exit(1);
console.log(`All ${found.size} reported advisories are accepted.`);
