// Compares `npm audit --json` (path in argv, default audit.json) against the
// advisories we have reviewed and accepted. Any advisory not listed here fails
// the check, whatever its severity; an accepted one that no longer appears is
// reported so its entry can be removed. Keep this list and AGENTS.md in step.
const fs = require("fs");

const ACCEPTED = {
  // expo-router -> query-string@7 -> decode-uri-component. The fix is ESM-only
  // and cannot be forced under a CJS parent; waits for expo-router upstream.
  "GHSA-vcc3-ghjq-m6fr": "decode-uri-component",
  // expo -> @expo/cli (and @expo/code-signing-certificates) -> node-forge.
  // Dev tooling only (EAS update code signing), never in the app bundle.
  // No patched release exists (1.4.0 is the latest and is affected).
  "GHSA-86w9-cpqp-85rv": "node-forge",
  // micromatch -> braces, under metro, jest and @expo/cli. Dev tooling only;
  // the glob patterns come from our own config, not from untrusted input.
  // No patched release exists (3.0.3 is the latest and is affected).
  "GHSA-vfj7-8cjw-p6xm": "braces",
};

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

const unexpected = [...found].filter(([id]) => !(id in ACCEPTED));
const resolved = Object.keys(ACCEPTED).filter((id) => !found.has(id));

console.log("npm audit counts:", audit.metadata.vulnerabilities);
for (const id of resolved) {
  console.log(
    `::warning::${id} (${ACCEPTED[id]}) no longer reported; remove it from scripts/check-audit.js and AGENTS.md`,
  );
}
if (unexpected.length > 0) {
  console.error(
    "npm audit reports advisories that are not in the accepted list:",
  );
  for (const [id, desc] of unexpected) console.error(`  ${id}: ${desc}`);
  console.error(
    "Fix them (an override in package.json), or review and add them to ACCEPTED in scripts/check-audit.js and to AGENTS.md.",
  );
  process.exit(1);
}
console.log(`All ${found.size} reported advisories are accepted.`);
