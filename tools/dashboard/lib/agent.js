/**
 * Runs the review-report skill (`.claude/skills/review-report/SKILL.md`) in
 * a headless Claude Code session, one report at a time.
 *
 * The session reads text strangers wrote (the report, the list), so it gets
 * as little as it needs: only the Read tool, for the report file and the
 * terms, and WebFetch limited to the video hosts DPM links to. No shell, no
 * edits, nothing it could send. Anything else it tries is refused without a
 * prompt (`--permission-mode dontAsk`).
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { REVIEW_SCHEMA, parseAgentOutput } = require("./review");

const VIDEO_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "www.dropbox.com",
  "dropbox.com",
];

/**
 * The `claude` command line for one review. `model` (an alias from
 * REVIEW_MODELS) wins over DPM_REVIEW_MODEL; neither means Claude Code's
 * default.
 */
function claudeArgs(inputFile, env = process.env, model = "") {
  const args = [
    "-p",
    `/review-report ${inputFile}`,
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(REVIEW_SCHEMA),
    "--tools",
    "Read,WebFetch,Skill",
    "--permission-mode",
    "dontAsk",
    "--allowedTools",
    "Skill(review-report)",
    // `//` marks an absolute path in a permission rule.
    `Read(/${inputFile})`,
    "Read(./TERMS_OF_USE.md)",
    ...VIDEO_HOSTS.map((h) => `WebFetch(domain:${h})`),
    // Reading inside the repository needs no permission; its secrets stay out.
    "--disallowedTools",
    "Read(./.env)",
    "Read(./.env.*)",
    "--add-dir",
    path.dirname(inputFile),
    "--max-budget-usd",
    env.DPM_REVIEW_BUDGET_USD || "2",
  ];
  const chosen = model || env.DPM_REVIEW_MODEL;
  if (chosen) args.push("--model", chosen);
  return args;
}

/**
 * The program to start. On Windows, npm installs `claude` as a `claude.cmd`
 * wrapper, which Node can't start without a shell (and a shell would mangle
 * the JSON schema argument), so this looks for the `claude.exe` behind it.
 */
function claudeBin(env = process.env, platform = process.platform) {
  if (env.DPM_CLAUDE_BIN) return env.DPM_CLAUDE_BIN;
  if (platform !== "win32") return "claude";
  const dirs = (env.PATH ?? env.Path ?? "").split(";").filter(Boolean);
  for (const dir of dirs) {
    for (const file of [
      path.join(dir, "claude.exe"),
      path.join(
        dir,
        "node_modules",
        "@anthropic-ai",
        "claude-code",
        "bin",
        "claude.exe",
      ),
    ]) {
      if (fs.existsSync(file)) return file;
    }
  }
  return "claude";
}

/**
 * Reviews one report. `input` is `agentInput(...)`; it goes to a private
 * temporary folder the session may read, deleted afterwards.
 *
 * @returns {Promise<{ review: object, costUsd: number | null, models: string[] }>}
 */
async function runReview(input, { repoRoot, env = process.env, model } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpm-report-"));
  const inputFile = path.join(dir, "report.json");
  fs.writeFileSync(inputFile, JSON.stringify(input, null, 2), { mode: 0o600 });
  try {
    const stdout = await run(
      claudeBin(env),
      claudeArgs(inputFile, env, model),
      repoRoot,
      Number(env.DPM_REVIEW_TIMEOUT_MS) || 10 * 60 * 1000,
    );
    return parseAgentOutput(stdout);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(cmd, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(
        e.code === "ENOENT"
          ? new Error(
              `"${cmd}" was not found. Install Claude Code, or set DPM_CLAUDE_BIN.`,
            )
          : e,
      );
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (signal)
        return reject(new Error(`The review agent stopped (${signal}).`));
      // A failed run still prints its JSON result; let the parser say why.
      if (code !== 0 && !stdout.trim()) {
        return reject(
          new Error(`The review agent failed: ${stderr.trim().slice(0, 500)}`),
        );
      }
      resolve(stdout);
    });
  });
}

/**
 * One review at a time: each spends money and minutes, and the operator
 * reads them one by one anyway.
 */
function reviewQueue(work) {
  const waiting = [];
  let current = null;

  async function next() {
    if (current || waiting.length === 0) return;
    current = waiting.shift();
    try {
      await work(current);
    } finally {
      current = null;
      next();
    }
  }

  return {
    /** Queues a report id; a no-op when it is already queued or running. */
    add(id, options = {}) {
      if (current?.id === id || waiting.some((w) => w.id === id)) return;
      waiting.push({ id, ...options });
      next();
    },
    busy() {
      return new Set(
        [current?.id, ...waiting.map((w) => w.id)].filter(Boolean),
      );
    },
    status() {
      return {
        running: current?.id ?? null,
        waiting: waiting.map((w) => w.id),
      };
    },
  };
}

module.exports = { claudeArgs, claudeBin, runReview, reviewQueue, VIDEO_HOSTS };
