/**
 * Where the Usage tab's figures come from. `googleUsage` asks Cloud
 * Monitoring and the Firebase Rules API with the read-only `dpm-ops` key;
 * `demoUsage` makes up a believable day for `npm run ops:demo` and the
 * tests. Both answer in Google's own shapes, so `usageView.js` turns either
 * into the page's figures.
 *
 * Metric names: https://cloud.google.com/monitoring/api/metrics_gcp (firestore).
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { quotaDayStart } = require("./usageView");

const METRIC = {
  reads: "firestore.googleapis.com/document/read_count",
  writes: "firestore.googleapis.com/document/write_count",
  deletes: "firestore.googleapis.com/document/delete_count",
  listeners: "firestore.googleapis.com/network/snapshot_listeners",
  connections: "firestore.googleapis.com/network/active_connections",
  requests: "firestore.googleapis.com/api/request_count",
};
const STEP = 300; // seconds per Monitoring point
const DAY = 86_400_000;

/** `t` rounded down to the 5-minute grid, which midnight Pacific is on. */
const onGrid = (t) => Math.floor(t / (STEP * 1000)) * STEP * 1000;

/**
 * @param {{ get: (url: string) => Promise<any> }} google from `googleClient`
 * @param {string} projectId
 */
function googleUsage(google, projectId) {
  const base = `https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries`;

  async function series(
    metric,
    { from, to, aligner, period = STEP, groupBy = [] },
  ) {
    const params = new URLSearchParams({
      filter: `metric.type="${metric}"`,
      "interval.startTime": new Date(from).toISOString(),
      "interval.endTime": new Date(to).toISOString(),
      "aggregation.alignmentPeriod": `${period}s`,
      "aggregation.perSeriesAligner": aligner,
      "aggregation.crossSeriesReducer": "REDUCE_SUM",
    });
    for (const g of groupBy) params.append("aggregation.groupByFields", g);
    const out = [];
    let pageToken = "";
    for (let page = 0; page < 10; page++) {
      if (pageToken) params.set("pageToken", pageToken);
      const json = await google.get(`${base}?${params}`);
      out.push(...(json.timeSeries ?? []));
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  }

  return {
    /** Yesterday's and today's quota day, plus listeners and requests today. */
    async monitoring(now = Date.now()) {
      const to = onGrid(now);
      const today = quotaDayStart(now);
      const from = quotaDayStart(today - 1);
      const delta = (m) => series(m, { from, to, aligner: "ALIGN_SUM" });
      const gauge = (m) => series(m, { from: today, to, aligner: "ALIGN_MAX" });
      const [reads, writes, deletes, listeners, connections, requests] =
        await Promise.all([
          delta(METRIC.reads),
          delta(METRIC.writes),
          delta(METRIC.deletes),
          gauge(METRIC.listeners),
          gauge(METRIC.connections),
          series(METRIC.requests, {
            from: today,
            to,
            aligner: "ALIGN_SUM",
            period: 3600,
            groupBy: ["metric.label.response_code", "metric.label.api_method"],
          }),
        ]);
      return { reads, writes, deletes, listeners, connections, requests };
    },

    /** The ruleset Firestore runs now: its source and when it was released. */
    async deployedRules() {
      const release = await google.get(
        `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/releases/cloud.firestore`,
      );
      const ruleset = await google.get(
        `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
      );
      return {
        rulesetName: release.rulesetName,
        updateTime: release.updateTime,
        source: (ruleset.source?.files ?? []).map((f) => f.content).join("\n"),
      };
    },
  };
}

/**
 * The rules to compare with: master's `firestore.rules` as the checkout last
 * fetched it (`origin/master`), or else the file in the checkout, named by
 * its branch. Reads git, never the network.
 */
function repoRules(repoRoot) {
  const git = (...args) =>
    execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  try {
    const commit = git("rev-parse", "--short", "origin/master");
    return {
      source: git("show", "origin/master:firestore.rules"),
      label: `master at ${commit}`,
    };
  } catch {}
  const source = fs.readFileSync(
    path.join(repoRoot, "firestore.rules"),
    "utf8",
  );
  let label = "firestore.rules in this checkout";
  try {
    label = `firestore.rules on ${git("rev-parse", "--abbrev-ref", "HEAD")} at ${git("rev-parse", "--short", "HEAD")}`;
  } catch {}
  return { source, label };
}

/** Points the way Monitoring sends them: newest first. */
function demoPoints(from, to, valueAt, period = STEP) {
  const points = [];
  for (let end = from + period * 1000; end <= to; end += period * 1000) {
    points.push({
      interval: {
        startTime: new Date(end - period * 1000).toISOString(),
        endTime: new Date(end).toISOString(),
      },
      value: { int64Value: String(Math.round(valueAt(end))) },
    });
  }
  return points.reverse();
}

/** A made-up but plausible day: busy evenings (Berlin), quiet nights. */
function demoUsage({ repoRoot } = {}) {
  const evening = (t) => {
    const h = new Date(t).getUTCHours();
    return h >= 16 && h <= 21 ? 1 : h >= 7 && h < 16 ? 0.35 : 0.08;
  };
  return {
    async monitoring(now = Date.now()) {
      const to = onGrid(now);
      const today = quotaDayStart(now);
      const from = quotaDayStart(today - 1);
      const one = (scale) => [
        { points: demoPoints(from, to, (t) => scale * evening(t)) },
      ];
      const gauge = (scale) => [
        { points: demoPoints(today, to, (t) => scale * evening(t)) },
      ];
      const req = (code, method, n) => ({
        metric: { labels: { response_code: code, api_method: method } },
        points: demoPoints(today, to, () => n, 3600),
      });
      return {
        reads: one(310),
        writes: one(22),
        deletes: one(1.5),
        listeners: gauge(14),
        connections: gauge(9),
        requests: [
          req("OK", "Listen", 40),
          req("OK", "Commit", 18),
          req("PERMISSION_DENIED", "Commit", 1),
          req("PERMISSION_DENIED", "RunQuery", 0.4),
          req("NOT_FOUND", "BatchGetDocuments", 2),
        ],
      };
    },

    async deployedRules() {
      // The repository's rules with one line missing, so the drift badge shows.
      let source = "";
      try {
        source = repoRoot ? repoRules(repoRoot).source : "";
      } catch {}
      const lines = source.split("\n");
      const at = lines.findIndex((l) => l.includes("notBlocked()"));
      if (at >= 0) lines.splice(at, 1);
      return {
        rulesetName: "projects/demo/rulesets/demo-ruleset-0001",
        updateTime: new Date(Date.now() - 3 * DAY).toISOString(),
        source: lines.join("\n"),
      };
    },
  };
}

module.exports = { googleUsage, demoUsage, repoRules, METRIC };
