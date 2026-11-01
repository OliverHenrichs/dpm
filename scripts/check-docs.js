// Keeps the docs honest (docs/README.md, "In CI"). Fails when:
//
// - a relative Markdown link in README.md, AGENTS.md files or docs/ points at
//   nothing (docs/history/ is frozen and skipped);
// - a path a product spec names in backticks (src/…, __tests__/…, tools/…,
//   modules/…, docs/…) does not exist, so a renamed file cannot leave a spec
//   pointing at it;
// - a nested AGENTS.md is missing from the root AGENTS.md index;
// - a file is over its size budget. Every line an agent loads is paid on every
//   turn, so a file that outgrows its budget is split, not let grow.
//
// OVER_BUDGET lists files that were already over when the check came in. Each
// may shrink but never grow past its cap; lower the cap (or drop the entry)
// whenever one is slimmed.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const KB = 1024;

const BUDGETS = [
  { test: (f) => f === "AGENTS.md", bytes: 24 * KB, why: "root AGENTS.md" },
  {
    test: (f) => f.endsWith("/AGENTS.md"),
    bytes: 10 * KB,
    why: "nested AGENTS.md",
  },
  {
    test: (f) => f.startsWith("docs/product/"),
    bytes: 15 * KB,
    why: "product spec",
  },
];

const OVER_BUDGET = {
  "src/pattern/graph/AGENTS.md": 27500,
  "src/pattern/data/AGENTS.md": 14600,
  "src/firebase/AGENTS.md": 12000,
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "android",
  "ios",
  "dist",
  "coverage",
  ".expo",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), {
    withFileTypes: true,
  })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(rel, out);
    else if (entry.name.endsWith(".md")) out.push(rel);
  }
  return out;
}

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const withoutCode = (text) => text.replace(/```[\s\S]*?```/g, "");

const files = walk("").filter(
  (f) =>
    !f.startsWith("docs/history/") &&
    (f === "README.md" || f.endsWith("AGENTS.md") || f.startsWith("docs/")),
);
const errors = [];

for (const file of files) {
  const text = withoutCode(read(file));

  for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
    const clean = decodeURI(target.split("#")[0]);
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), clean),
    );
    if (!exists(resolved))
      errors.push(`${file}: link to ${target} points at nothing`);
  }

  if (file.startsWith("docs/product/")) {
    for (const [, named] of text.matchAll(
      /`((?:src|__tests__|tools|modules|docs)\/[^`\s*<>]+)`/g,
    )) {
      const clean = named.replace(/[.,:;)]+$/, "").replace(/\/$/, "");
      if (!exists(clean))
        errors.push(`${file}: names ${named}, which does not exist`);
    }
  }

  const budget = BUDGETS.find((b) => b.test(file));
  if (budget) {
    const size = fs.statSync(path.join(ROOT, file)).size;
    const cap = OVER_BUDGET[file] ?? budget.bytes;
    if (size > cap) {
      errors.push(
        `${file}: ${size} bytes, over its ${OVER_BUDGET[file] ? "cap" : budget.why + " budget"} of ${cap}. Split it rather than let it grow.`,
      );
    }
  }
}

for (const [file, cap] of Object.entries(OVER_BUDGET)) {
  if (!exists(file))
    errors.push(`OVER_BUDGET names ${file}, which no longer exists`);
  else if (fs.statSync(path.join(ROOT, file)).size <= BUDGETS[1].bytes) {
    errors.push(
      `${file} is within budget now: drop it from OVER_BUDGET (cap ${cap})`,
    );
  }
}

const rootIndex = read("AGENTS.md");
for (const file of files) {
  if (file.endsWith("/AGENTS.md") && !rootIndex.includes(`\`${file}\``)) {
    errors.push(`${file} is not listed in the root AGENTS.md index`);
  }
}

if (errors.length) {
  console.error(
    `check-docs: ${errors.length} problem(s)\n- ${errors.join("\n- ")}`,
  );
  process.exit(1);
}
console.log(`check-docs: ${files.length} files OK`);
