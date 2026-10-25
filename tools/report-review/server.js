#!/usr/bin/env node
/**
 * The report review dashboard: a local web page listing every report about a
 * published list, with the list it is about, an agent's review and draft reply
 * (the review-report skill), and the operator's verdict and actions. Run from
 * the repository root with `npm run reports:review`; see README.md.
 *
 * It listens on 127.0.0.1 only, and every API call needs the token printed at
 * start, so no other page in the browser can drive it.
 */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const {
  DECISIONS,
  agentInput,
  stage,
  needsAutoReview,
  byPriority,
  looksLikeReportId,
} = require("./lib/review");
const { firebaseStore, demoStore } = require("./lib/store");
const { reviewStore, defaultDir } = require("./lib/reviews");
const { runReview, reviewQueue } = require("./lib/agent");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PAGE = path.join(__dirname, "public", "index.html");

const USAGE = `Usage: npm run reports:review -- [options]

  --every <minutes>   Fetch reports this often (default 5; change it on the page too).
  --auto-review       Start with auto review on: every new report gets an agent review.
  --port <port>       Default 4777.
  --demo              Made-up reports in memory instead of Firestore
                      (npm run reports:demo). Agent reviews still run for real.`;

function parseArgs(argv) {
  const opts = { every: 5, port: 4777, autoReview: false, demo: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--every") opts.every = Number(argv[++i]);
    else if (a === "--port") opts.port = Number(argv[++i]);
    else if (a === "--auto-review") opts.autoReview = true;
    else if (a === "--demo") opts.demo = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`Unknown option ${a}\n\n${USAGE}`);
  }
  if (!(opts.every >= 1)) throw new Error("--every needs at least 1 minute.");
  return opts;
}

function createDashboard({ store, reviews, settingsFile, opts, review }) {
  const saved = readJson(settingsFile) ?? {};
  const state = {
    refreshMinutes: saved.refreshMinutes ?? opts.every,
    autoReview: opts.autoReview || !!saved.autoReview,
    views: [],
    refreshedAt: null,
    nextRefreshAt: null,
    error: null,
    lastAgentError: null,
  };
  let timer = null;

  const queue = reviewQueue(async ({ id, redraft }) => {
    const view = state.views.find((v) => v.id === id);
    if (!view) return;
    const before = reviews.get(id);
    const decision = redraft ? before?.decision : undefined;
    try {
      const { review: result, costUsd } = await review(
        agentInput(view, state.views, decision),
      );
      if (!state.views.some((v) => v.id === id)) return; // deleted meanwhile
      reviews.update(id, {
        reportCreatedAt: view.createdAt,
        review: result,
        reviewedAt: new Date().toISOString(),
        costUsd,
        email: { subject: result.email.subject, body: result.email.body },
        error: null,
        failedFor: null,
        // A review of a newer report from the same phone starts over.
        ...(before?.reportCreatedAt !== view.createdAt && {
          decision: null,
          done: [],
        }),
      });
    } catch (e) {
      state.lastAgentError = e.message;
      if (state.views.some((v) => v.id === id)) {
        reviews.update(id, { error: e.message, failedFor: view.createdAt });
      }
    }
  });

  function saveSettings() {
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({
        refreshMinutes: state.refreshMinutes,
        autoReview: state.autoReview,
      }),
      { mode: 0o600 },
    );
  }

  function schedule() {
    clearTimeout(timer);
    const ms = state.refreshMinutes * 60 * 1000;
    state.nextRefreshAt = new Date(Date.now() + ms).toISOString();
    timer = setTimeout(refresh, ms);
    timer.unref?.();
  }

  async function refresh() {
    try {
      state.views = (await store.load()).sort(byPriority);
      // A takedown replaces the owner record, so the publisher's id is
      // remembered from before it (for blocking them afterwards).
      for (const v of state.views) {
        if (v.publisherUid) continue;
        v.publisherUid = reviews.get(v.id)?.publisherUid ?? null;
        if (v.publisherUid) {
          v.publisherBlockedSince = await store.blockedSince(v.publisherUid);
        }
      }
      state.refreshedAt = new Date().toISOString();
      state.error = null;
      const busy = queue.busy();
      reviews.prune([...state.views.map((v) => v.id), ...busy]);
      if (state.autoReview) {
        needsAutoReview(state.views, reviews.all(), busy).forEach((v) =>
          queue.add(v.id),
        );
      }
    } catch (e) {
      state.error = e.message;
    }
    schedule();
  }

  function snapshot() {
    const all = reviews.all();
    const busy = queue.busy();
    return {
      project: store.projectId,
      emulated: !!store.emulated,
      demo: !!store.demo,
      refreshMinutes: state.refreshMinutes,
      autoReview: state.autoReview,
      refreshedAt: state.refreshedAt,
      nextRefreshAt: state.nextRefreshAt,
      error: state.error,
      lastAgentError: state.lastAgentError,
      queue: queue.status(),
      reports: state.views.map((v) => ({
        ...v,
        stage: stage(v, all[v.id], busy.has(v.id)),
        saved: all[v.id]?.reportCreatedAt === v.createdAt ? all[v.id] : null,
        failed:
          all[v.id]?.failedFor === v.createdAt ? all[v.id].error : undefined,
      })),
    };
  }

  function viewOf(id) {
    if (!looksLikeReportId(id)) throw httpError(400, "Not a report id.");
    const view = state.views.find((v) => v.id === id);
    if (!view) throw httpError(404, "No such report (refresh?).");
    return view;
  }

  const api = {
    "GET /api/state": () => snapshot(),

    "POST /api/refresh": async () => {
      await refresh();
      return snapshot();
    },

    "POST /api/settings": async ({ refreshMinutes, autoReview }) => {
      if (refreshMinutes !== undefined) {
        const m = Number(refreshMinutes);
        if (!(m >= 1 && m <= 24 * 60))
          throw httpError(400, "1 to 1440 minutes.");
        state.refreshMinutes = m;
        schedule();
      }
      if (autoReview !== undefined) state.autoReview = !!autoReview;
      saveSettings();
      if (state.autoReview) {
        needsAutoReview(state.views, reviews.all(), queue.busy()).forEach((v) =>
          queue.add(v.id),
        );
      }
      return snapshot();
    },

    /** Runs the skill; `redraft` passes the operator's verdict and note to it. */
    "POST /api/review": ({ id, redraft }) => {
      const view = viewOf(id);
      if (redraft && !reviews.get(id)?.decision) {
        throw httpError(400, "Decide first, then redraft.");
      }
      if (reviews.get(id)?.failedFor === view.createdAt) {
        reviews.update(id, { error: null, failedFor: null });
      }
      queue.add(id, { redraft: !!redraft });
      return snapshot();
    },

    "POST /api/decision": ({ id, verdict, note }) => {
      const view = viewOf(id);
      if (verdict !== null && !DECISIONS.includes(verdict)) {
        throw httpError(400, "The verdict is uphold or reject.");
      }
      reviews.update(id, {
        reportCreatedAt: view.createdAt,
        decision: verdict
          ? { verdict, note: String(note ?? ""), decidedAt: now() }
          : null,
      });
      return snapshot();
    },

    "POST /api/email": ({ id, subject, body }) => {
      const view = viewOf(id);
      reviews.update(id, {
        reportCreatedAt: view.createdAt,
        email: { subject: String(subject ?? ""), body: String(body ?? "") },
      });
      return snapshot();
    },

    "POST /api/mark": ({ id, action }) => {
      viewOf(id);
      if (action !== "email-sent") throw httpError(400, "Unknown mark.");
      record(id, action);
      return snapshot();
    },

    /**
     * The irreversible ones. Each must be confirmed by typing back what it
     * acts on, as the data removal tool asks on the command line.
     */
    "POST /api/action": async ({ id, action, confirm }) => {
      const view = viewOf(id);
      if (action === "remove-list") {
        if (confirm !== view.shareCode)
          throw httpError(400, "Type the share code.");
        if (view.listStatus === "taken-down")
          throw httpError(400, "Already taken down.");
        await store.removeList(view.shareCode);
        for (const v of state.views) {
          if (v.shareCode === view.shareCode && view.publisherUid) {
            reviews.update(v.id, {
              reportCreatedAt: v.createdAt,
              publisherUid: view.publisherUid,
            });
          }
        }
        record(id, action);
      } else if (action === "block-publisher") {
        if (!view.publisherUid) throw httpError(400, "No publisher to block.");
        if (confirm !== view.publisherUid)
          throw httpError(400, "Type the publisher's id.");
        await store.blockUser(view.publisherUid);
        record(id, action);
      } else if (action === "delete-report") {
        if (confirm !== view.shareCode)
          throw httpError(400, "Type the share code.");
        await store.deleteReport(id);
        reviews.remove(id);
      } else {
        throw httpError(400, "Unknown action.");
      }
      await refresh();
      return snapshot();
    },
  };

  function record(id, action) {
    const prev = reviews.get(id)?.done ?? [];
    reviews.update(id, { done: [...prev, { action, at: now() }] });
  }

  return {
    api,
    refresh,
    stop: () => clearTimeout(timer),
    queue,
  };
}

function now() {
  return new Date().toISOString();
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (d) => {
      body += d;
      if (body.length > 1e6) reject(httpError(413, "Too large."));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(httpError(400, "Not JSON."));
      }
    });
  });
}

/**
 * The HTTP side. Refuses any Host but its own (DNS rebinding) and any API call
 * without the token, which only the printed link carries.
 */
function createServer(dashboard, { port, token }) {
  const page = fs.readFileSync(PAGE, "utf8");
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return http.createServer(async (req, res) => {
    const send = (status, body, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": `${type}; charset=utf-8`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        ...(type === "text/html" && {
          "Content-Security-Policy":
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        }),
      });
      res.end(type === "application/json" ? JSON.stringify(body) : body);
    };
    if (!hosts.has(req.headers.host))
      return send(403, { error: "Wrong host." });
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") {
      return send(200, page, "text/html");
    }
    const handler = dashboard.api[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: "Not found." });
    const given = String(req.headers["x-dpm-token"] ?? "");
    if (
      given.length !== token.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))
    ) {
      return send(401, { error: "Open the link the dashboard printed." });
    }
    try {
      const body = req.method === "POST" ? await readBody(req) : {};
      send(200, await handler(body));
    } catch (e) {
      send(e.status ?? 500, { error: e.message });
    }
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }
  let store;
  if (opts.demo) {
    store = demoStore();
  } else {
    const { connect } = require("../data-removal/lib/firestore");
    store = firebaseStore(connect());
  }
  const dir = path.join(defaultDir(), opts.demo ? "demo" : store.projectId);
  const reviews = reviewStore(dir);
  const dashboard = createDashboard({
    store,
    reviews,
    settingsFile: path.join(dir, "settings.json"),
    opts,
    review: (input) => runReview(input, { repoRoot: REPO_ROOT }),
  });
  await dashboard.refresh();
  const token = crypto.randomBytes(24).toString("hex");
  const server = createServer(dashboard, { port: opts.port, token });
  server.listen(opts.port, "127.0.0.1", () => {
    console.log(
      `Project ${store.projectId}${opts.demo ? " (demo data)" : store.emulated ? " (emulator)" : ""}`,
    );
    console.log(`Reviews kept in ${dir}`);
    console.log(`\nOpen http://127.0.0.1:${opts.port}/#${token}\n`);
    console.log("Ctrl+C stops it. Nothing is sent to anyone from here.");
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  });
}

module.exports = { createDashboard, createServer, parseArgs };
