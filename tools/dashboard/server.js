#!/usr/bin/env node
/**
 * The DPM operations dashboard: reports about published lists, the data
 * removal tool on a page, and (later) usage and Play figures. Run from the
 * repository root with `npm run ops`; see README.md.
 *
 * Two ways to run it:
 *
 * - On the laptop (default): plain HTTP on 127.0.0.1, every API call needs
 *   the token from the printed link, so no other page in the browser can
 *   drive it.
 * - On the Raspberry Pi (`--lan`): HTTPS for the home network. Only browsers
 *   with one of the operator's device certificates get in (`pki.js`), and
 *   whatever deletes or blocks needs a passkey from that device
 *   (`lib/access.js`).
 */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");
const { firebaseStore, demoStore } = require("./lib/store");
const { reviewStore, defaultDir } = require("./lib/reviews");
const { runReview } = require("./lib/agent");
const { createReports } = require("./lib/reports");
const { createData, DESTRUCTIVE } = require("./lib/data");
const { caseStore } = require("./lib/cases");
const { actionLog } = require("./lib/actionLog");
const { createAccess } = require("./lib/access");
const { readBody } = require("./lib/http");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PAGE = path.join(__dirname, "public", "index.html");
/** Rajdhani and Share Tech Mono (SIL OFL), served from here: the page loads nothing from outside. */
const FONTS = path.join(__dirname, "public", "fonts");

const USAGE = `Usage: npm run ops -- [options]

  --every <minutes>   Fetch reports this often (default 5; change it on the page too).
  --agent             Turn agent reviews on (off by default: a review sends the
                      report's text and the list to Anthropic).
  --auto-review       Also start with auto review on: every new report gets an
                      agent review. Implies --agent.
  --port <port>       Default 4777.
  --demo              Made-up lists and reports in memory instead of Firestore
                      (npm run ops:demo). Agent reviews still run for real.

  --lan               Serve the home network over HTTPS (on the Raspberry Pi):
                      device certificates and passkeys instead of the token
                      link. Needs \`npm run ops:pki -- init\` first.
  --name <host>       The Pi's name on the network, as in the server
                      certificate (default: the name pki.js init was given).
  --listen <address>  Default 0.0.0.0 with --lan, 127.0.0.1 without.`;

function parseArgs(argv) {
  const opts = {
    every: 5,
    port: 4777,
    agent: false,
    autoReview: false,
    demo: false,
    lan: false,
    name: null,
    listen: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--every") opts.every = Number(argv[++i]);
    else if (a === "--port") opts.port = Number(argv[++i]);
    else if (a === "--agent") opts.agent = true;
    else if (a === "--auto-review") opts.agent = opts.autoReview = true;
    else if (a === "--demo") opts.demo = true;
    else if (a === "--lan") opts.lan = true;
    else if (a === "--name") opts.name = argv[++i];
    else if (a === "--listen") opts.listen = argv[++i];
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`Unknown option ${a}\n\n${USAGE}`);
  }
  if (!(opts.every >= 1)) throw new Error("--every needs at least 1 minute.");
  opts.listen ??= opts.lan ? "0.0.0.0" : "127.0.0.1";
  return opts;
}

/** Where the dashboard keeps its own files (cases, the action log, access). */
function dashboardDir(env = process.env) {
  return (
    env.DPM_DASHBOARD_DIR ||
    path.join(os.homedir(), ".local", "share", "dpm", "dashboard")
  );
}

/**
 * All tabs' APIs in one table. The Reports tab keeps its paths from before
 * the dashboard had tabs (`/api/state`, `/api/action`, …).
 */
function createDashboard({
  store,
  reviews,
  settingsFile,
  opts,
  review,
  cases,
  log,
}) {
  const reports = createReports({
    store,
    reviews,
    settingsFile,
    opts,
    review,
    log: (entry) => log.append(entry),
  });
  const data = createData({ store, cases, log });
  return {
    api: { ...reports.api, ...data.api },
    refresh: reports.refresh,
    stop: reports.stop,
    queue: reports.queue,
  };
}

const SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const PAGE_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * The HTTP side. Refuses any Host but its own (DNS rebinding) and any API call
 * without the token. On the laptop only the printed link carries the token;
 * on the Pi the page carries it, and only a device with a valid certificate
 * gets the page. A custom header can't be sent cross-site without CORS, which
 * this server never allows, so another site can't drive the API even through
 * a browser holding a device certificate.
 *
 * @param {{ port: number, token: string, hosts?: string[], tls?: object, access?: ReturnType<typeof createAccess> }} options
 */
function createServer(dashboard, { port, token, hosts, tls, access }) {
  const page = fs.readFileSync(PAGE, "utf8");
  const allowed = new Set(hosts ?? [`127.0.0.1:${port}`, `localhost:${port}`]);
  const mode = access ? "lan" : "local";

  const accessApi = access && {
    "GET /api/access": (_, { device }) => ({ mode, ...access.status(device) }),
    "POST /api/access/register-options": ({ code }, { device }) =>
      access.registerOptions(device, code),
    "POST /api/access/register": (body, { device }) =>
      access.register(device, body),
    "POST /api/access/assert-options": (_, { device }) =>
      access.assertOptions(device),
    "POST /api/access/assert": (body, { device }) =>
      access.assert(device, body),
    "POST /api/access/disarm": (_, { device }) => {
      access.disarm(device);
      return { mode, ...access.status(device) };
    },
  };
  const api = {
    ...dashboard.api,
    ...(accessApi ?? { "GET /api/access": () => ({ mode, device: "local" }) }),
  };

  const handle = async (req, res) => {
    const send = (status, body, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": `${type}; charset=utf-8`,
        ...SECURITY_HEADERS,
        ...(tls && { "Strict-Transport-Security": "max-age=31536000" }),
        ...(type === "text/html" && { "Content-Security-Policy": PAGE_CSP }),
      });
      res.end(type === "application/json" ? JSON.stringify(body) : body);
    };
    if (!allowed.has(req.headers.host)) {
      return send(403, { error: "Wrong host." });
    }
    let device = "local";
    try {
      if (access) device = access.deviceOf(req.socket);
    } catch (e) {
      return send(e.status ?? 403, { error: e.message });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") {
      // On the Pi the page itself carries the token (only certificate
      // holders get the page); on the laptop the printed link does.
      return send(
        200,
        access
          ? page.replace(
              "<!--dpm-token-->",
              `<meta name="dpm-token" content="${token}" />`,
            )
          : page,
        "text/html",
      );
    }
    const font = /^\/fonts\/([a-z0-9-]+\.woff2)$/.exec(url.pathname);
    if (req.method === "GET" && font) {
      try {
        const file = fs.readFileSync(path.join(FONTS, font[1]));
        res.writeHead(200, {
          "Content-Type": "font/woff2",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "max-age=604800",
        });
        return res.end(file);
      } catch {
        return send(404, { error: "Not found." });
      }
    }
    const key = `${req.method} ${url.pathname}`;
    const handler = api[key];
    if (!handler) return send(404, { error: "Not found." });
    const given = String(req.headers["x-dpm-token"] ?? "");
    if (
      given.length !== token.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token))
    ) {
      return send(401, { error: "Open the link the dashboard printed." });
    }
    try {
      if (access && DESTRUCTIVE.has(key)) access.requireArmed(device);
      const body = req.method === "POST" ? await readBody(req) : {};
      send(200, await handler(body, { device }));
    } catch (e) {
      send(e.status ?? 500, { error: e.message });
    }
  };

  if (!tls) return http.createServer(handle);
  return https.createServer(
    {
      ...tls,
      // The handshake only lets in certificates our own CA issued; the
      // device list then decides which of them are still welcome.
      requestCert: true,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    handle,
  );
}

/** The TLS files and server name `pki.js init` wrote. */
function loadTls(root) {
  const dir = path.join(root, "tls");
  const read = (f) => fs.readFileSync(path.join(dir, f));
  try {
    return {
      tls: {
        key: read("server.key"),
        cert: read("server.crt"),
        ca: read("ca.crt"),
      },
      name: JSON.parse(read("server.json")).name,
    };
  } catch {
    throw new Error(
      `No certificates in ${dir}. Run \`npm run ops:pki -- init --name <host>\` first.`,
    );
  }
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
  const project = opts.demo ? "demo" : store.projectId;
  const reviewDir = path.join(defaultDir(), project);
  const root = dashboardDir();
  const own = path.join(root, project);
  fs.mkdirSync(own, { recursive: true, mode: 0o700 });
  const log = actionLog(path.join(own, "actions.jsonl"));
  const pruned = log.prune();
  const dashboard = createDashboard({
    store,
    reviews: reviewStore(reviewDir),
    settingsFile: path.join(reviewDir, "settings.json"),
    opts,
    review: (input, { model }) =>
      runReview(input, { repoRoot: REPO_ROOT, model }),
    cases: caseStore(path.join(own, "cases")),
    log,
  });
  await dashboard.refresh();
  const token = crypto.randomBytes(24).toString("hex");

  let server;
  let link;
  if (opts.lan) {
    const { tls, name: certName } = loadTls(root);
    const name = opts.name ?? certName;
    const hostPort = opts.port === 443 ? name : `${name}:${opts.port}`;
    const access = createAccess({
      dir: path.join(root, "access"),
      rpId: name,
      origin: `https://${hostPort}`,
    });
    server = createServer(dashboard, {
      port: opts.port,
      token,
      hosts: [hostPort],
      tls,
      access,
    });
    link = `https://${hostPort}/`;
  } else {
    server = createServer(dashboard, { port: opts.port, token });
    link = `http://127.0.0.1:${opts.port}/#${token}`;
  }

  server.listen(opts.port, opts.listen, () => {
    console.log(
      `Project ${store.projectId}${opts.demo ? " (demo data)" : store.emulated ? " (emulator)" : ""}`,
    );
    console.log(`Report notes in ${reviewDir}`);
    console.log(`Cases and action log in ${own}`);
    if (pruned)
      console.log(`Dropped ${pruned} action log lines older than two years.`);
    console.log(`\nOpen ${link}\n`);
    console.log("Ctrl+C stops it. Nothing is sent to anyone from here.");
  });
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  });
}

module.exports = { createDashboard, createServer, parseArgs, dashboardDir };
