// Compares `npm audit --json` (path in argv, default audit.json) against the
// advisories we have reviewed and accepted. Any advisory not listed here fails
// the check, whatever its severity; an accepted one that no longer appears is
// reported so its entry can be removed. Each entry says why it is accepted.
//
// Every acceptance expires: past `until` (a UTC date) the advisory fails the
// check again, so it is re-reviewed rather than accepted indefinitely. Check
// whether a fix has shipped; if not, set a new date. Within WARN_DAYS of the
// date the check passes with a warning.
const fs = require("fs");

const ACCEPTED = {
  // expo-router -> query-string@7 -> decode-uri-component@0.2. The fixes
  // (0.4.3, 0.5.1) are ESM-only and cannot be forced under a CJS parent; waits
  // for expo-router upstream. Both are slow-decoding DoS on crafted URLs, at
  // worst a hang of the app on the phone that opens such a link.
  "GHSA-vcc3-ghjq-m6fr": { name: "decode-uri-component", until: "2026-12-01" },
  "GHSA-qr28-fpjm-wq7f": { name: "decode-uri-component", until: "2026-12-01" },
  // @expo/config, jest-config -> deepmerge. Dev tooling only, merging our own
  // config objects, never in the app bundle. No patched release exists
  // (4.3.1 is the latest and is affected).
  "GHSA-gcqx-w48m-w2h4": { name: "deepmerge", until: "2026-12-01" },
  // @expo/config, @expo/config-plugins, @expo/fingerprint, @expo/metro-config,
  // @jest/reporters, test-exclude -> glob@10/13. Dev and build tooling only,
  // never in the app bundle; none of them pass an AbortSignal, which is what
  // the bypass needs. The fix is glob 14, a major the Expo packages don't allow.
  "GHSA-3g3m-2fjr-6pw4": { name: "glob", until: "2026-12-01" },
  // eslint, glob, @expo/fingerprint, test-exclude -> minimatch@3/9/10. Dev and
  // build tooling only, matching our own patterns, never in the app bundle.
  // The fix is minimatch 11, a major none of these parents allow.
  "GHSA-g3hv-75wg-m249": { name: "minimatch", until: "2026-12-01" },
  // expo -> @expo/cli -> zod@3. Dev tooling only (validates our own app config),
  // never in the app bundle. No patched 3.x exists; the fix is a major Expo upgrade.
  // The root zod@4 (eslint-plugin-react-hooks) is overridden to a patched release.
  "GHSA-mrhx-c7xc-m3w5": { name: "zod", until: "2026-12-01" },
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
    `::warning::${id} (${ACCEPTED[id].name}) no longer reported; remove it from scripts/check-audit.js`,
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
    "Fix them (an override in package.json), or review and add them to ACCEPTED in scripts/check-audit.js with the reason.",
  );
  failed = true;
}
if (failed) process.exit(1);
console.log(`All ${found.size} reported advisories are accepted.`);
