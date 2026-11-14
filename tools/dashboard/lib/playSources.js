/**
 * Where the Play tab's figures come from. `googlePlay` asks Google Play with
 * the `dpm-ops` key: the Play Developer Reporting API (Android vitals, crash
 * clusters, releases per track), the Android Publisher API (reviews, and a
 * reply when the operator sends one) and, if a bucket is set, the monthly
 * installs reports in Cloud Storage. `demoPlay` makes up an alpha's worth of
 * figures for `npm run ops:demo` and the tests. Both answer in Google's own
 * shapes, so `playView.js` turns either into the page's figures.
 */

const { dateTime, latestDaily } = require("./playView");

const REPORTING = "https://playdeveloperreporting.googleapis.com/v1beta1";
const PUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const DAY = 86_400_000;
const HOUR = 3_600_000;

/** The metric sets the tab shows, and the metrics read from each. */
const METRIC_SETS = {
  crash: {
    set: "crashRateMetricSet",
    metrics: ["crashRate", "userPerceivedCrashRate", "distinctUsers"],
  },
  anr: {
    set: "anrRateMetricSet",
    metrics: ["anrRate", "userPerceivedAnrRate", "distinctUsers"],
  },
  // Play requires the start type here; the tab shows cold starts.
  slowStart: {
    set: "slowStartRateMetricSet",
    metrics: ["slowStartRate", "distinctUsers"],
    dimensions: ["startType", "versionCode"],
  },
  // Slow frames (slowRenderingRateMetricSet) are only served for games.
};

/** A calendar day (given as UTC midnight) as a daily DateTime: Play's days are Pacific. */
function calendarDay(t) {
  const d = new Date(t);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    timeZone: { id: "America/Los_Angeles" },
  };
}

/** `interval.*` query parameters for an hour-aligned UTC range. */
function utcInterval(params, from, to) {
  for (const [k, t] of [
    ["startTime", from],
    ["endTime", to],
  ]) {
    const d = new Date(Math.floor(t / HOUR) * HOUR);
    params.set(`interval.${k}.year`, d.getUTCFullYear());
    params.set(`interval.${k}.month`, d.getUTCMonth() + 1);
    params.set(`interval.${k}.day`, d.getUTCDate());
    params.set(`interval.${k}.hours`, d.getUTCHours());
    params.set(`interval.${k}.timeZone.id`, "UTC");
  }
}

/**
 * @param {{ get: Function, post: Function, bytes: Function }} google from `googleClient`
 * @param {string} pkg the app's package name
 * @param {{ bucket?: string | null }} [options] Play's bulk reports bucket
 */
function googlePlay(google, pkg, { bucket = null } = {}) {
  const app = `${REPORTING}/apps/${encodeURIComponent(pkg)}`;
  const pub = `${PUBLISHER}/applications/${encodeURIComponent(pkg)}`;

  /** 28 days of daily rows per version, up to the newest day Play has. */
  async function metricSet(
    { set, metrics, dimensions = ["versionCode"] },
    now,
  ) {
    const info = await google.get(`${app}/${set}`);
    const end = latestDaily(info) ?? dateTime(now - DAY);
    const endMs = Date.UTC(end.year, end.month - 1, end.day);
    const rows = [];
    let pageToken;
    for (let page = 0; page < 5; page++) {
      const json = await google.post(`${app}/${set}:query`, {
        timelineSpec: {
          aggregationPeriod: "DAILY",
          startTime: calendarDay(endMs - 27 * DAY),
          endTime: calendarDay(endMs),
        },
        dimensions,
        metrics,
        pageSize: 1000,
        ...(pageToken && { pageToken }),
      });
      rows.push(...(json.rows ?? []));
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
    return rows;
  }

  return {
    /** Each metric set on its own, so one refused set doesn't hide the rest. */
    async vitals(now = Date.now()) {
      const keys = Object.keys(METRIC_SETS);
      const settled = await Promise.allSettled(
        keys.map((k) => metricSet(METRIC_SETS[k], now)),
      );
      return Object.fromEntries(
        keys.map((k, i) => [
          k,
          settled[i].status === "fulfilled"
            ? { rows: settled[i].value }
            : { error: settled[i].reason.message },
        ]),
      );
    },

    /** Which releases each track serves. */
    async releases() {
      return google.get(`${app}:fetchReleaseFilterOptions`);
    },

    /** The ten biggest crash and ANR clusters of 28 days, and a trace for the top five. */
    async issues(now = Date.now()) {
      const params = new URLSearchParams({
        filter: "errorIssueType = CRASH OR errorIssueType = ANR",
        orderBy: "errorReportCount desc",
        pageSize: "10",
      });
      utcInterval(params, now - 28 * DAY, now - HOUR);
      let json;
      try {
        json = await google.get(`${app}/errorIssues:search?${params}`);
      } catch (e) {
        if (e.googleStatus !== 400) throw e;
        // An interval Google won't take: its default (the last day) instead.
        for (const k of [...params.keys()])
          if (k.startsWith("interval.")) params.delete(k);
        json = await google.get(`${app}/errorIssues:search?${params}`);
      }
      const issues = json.errorIssues ?? [];
      const samples = {};
      await Promise.all(
        issues.slice(0, 5).map(async (i) => {
          const id = String(i.name ?? "")
            .split("/")
            .pop();
          if (!/^[\w-]+$/.test(id)) return;
          const p = new URLSearchParams({
            filter: `errorIssueId = ${id}`,
            pageSize: "1",
          });
          utcInterval(p, now - 28 * DAY, now - HOUR);
          try {
            const r = await google.get(`${app}/errorReports:search?${p}`);
            if (r.errorReports?.[0]) samples[id] = r.errorReports[0];
          } catch {}
        }),
      );
      return { issues, samples };
    },

    /** Every review Play still lists (it drops them after about a week). */
    async reviews() {
      const out = [];
      let token;
      for (let page = 0; page < 20; page++) {
        const p = new URLSearchParams({ maxResults: "100" });
        if (token) p.set("token", token);
        const json = await google.get(`${pub}/reviews?${p}`);
        out.push(...(json.reviews ?? []));
        token = json.tokenPagination?.nextPageToken;
        if (!token) break;
      }
      return out;
    },

    /** Publishes a reply under a review on Google Play. */
    async reply(reviewId, text) {
      return google.post(
        `${pub}/reviews/${encodeURIComponent(reviewId)}:reply`,
        { replyText: text },
      );
    },

    /** This month's and last month's installs overview CSVs, if a bucket is set. */
    async installs(now = Date.now()) {
      if (!bucket) return null;
      const b = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`;
      const list = await google.get(
        `${b}?${new URLSearchParams({ prefix: `stats/installs/installs_${pkg}_` })}`,
      );
      const month = (t) => {
        const d = new Date(t);
        return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      };
      const wanted = [month(now - 31 * DAY), month(now)].map(
        (m) => `stats/installs/installs_${pkg}_${m}_overview.csv`,
      );
      const names = (list.items ?? [])
        .map((i) => i.name)
        .filter((n) => wanted.includes(n));
      return Promise.all(
        names.map((n) =>
          google.bytes(`${b}/${encodeURIComponent(n)}?alt=media`),
        ),
      );
    },
  };
}

/** Rows the way the Reporting API sends them, for the demo. */
function demoRows(metrics, versions, now, rateOf) {
  const rows = [];
  for (let d = 27; d >= 0; d--) {
    const t = dateTime(now - (d + 2) * DAY);
    for (const [code, from, users] of versions) {
      if (28 - d < from) continue;
      const u = Math.max(1, Math.round(users * (0.7 + 0.3 * Math.sin(d))));
      rows.push({
        aggregationPeriod: "DAILY",
        startTime: t,
        dimensions: [{ dimension: "versionCode", int64Value: String(code) }],
        metrics: metrics.map((m) => ({
          metric: m,
          decimalValue: {
            value: String(m === "distinctUsers" ? u : rateOf(m, code, d)),
          },
        })),
      });
    }
  }
  return rows;
}

/** A made-up alpha: three builds, a crash that 1.7.0 fixed, a few reviews. */
function demoPlay() {
  const replies = new Map();
  const versions = [
    [41, 0, 9],
    [42, 10, 12],
    [43, 20, 14],
  ];
  const ts = (t) => ({ seconds: String(Math.floor(t / 1000)), nanos: 0 });
  return {
    async vitals(now = Date.now()) {
      const rate = (base) => (m, code, d) =>
        (code === 42 ? base * 3 : base) *
        (0.6 + 0.4 * Math.cos(d)) *
        (m.startsWith("userPerceived") ? 0.7 : 1);
      return {
        crash: {
          rows: demoRows(METRIC_SETS.crash.metrics, versions, now, rate(0.006)),
        },
        anr: {
          rows: demoRows(METRIC_SETS.anr.metrics, versions, now, rate(0.002)),
        },
        slowStart: {
          rows: ["COLD", "WARM"].flatMap((startType) =>
            demoRows(METRIC_SETS.slowStart.metrics, versions, now, () =>
              startType === "COLD" ? 0.08 : 0.02,
            ).map((r) => ({
              ...r,
              dimensions: [
                { dimension: "startType", stringValue: startType },
                ...r.dimensions,
              ],
            })),
          ),
        },
      };
    },
    async releases() {
      // The shape Play really sends: track ids as names, kinds as types.
      return {
        tracks: [
          {
            displayName: "production",
            type: "Production",
            servingReleases: [{ displayName: "1.7.0", versionCodes: ["43"] }],
          },
          { displayName: "beta", type: "Open testing", servingReleases: [] },
          {
            displayName: "alpha",
            type: "Closed testing",
            servingReleases: [{ displayName: "1.7.0", versionCodes: ["43"] }],
          },
          {
            displayName: "internal",
            type: "Internal",
            servingReleases: [{ displayName: "1.6.0", versionCodes: ["42"] }],
          },
        ],
      };
    },
    async issues(now = Date.now()) {
      return {
        issues: [
          {
            name: "apps/demo/errorIssues/demo-oom",
            type: "CRASH",
            cause: "java.lang.OutOfMemoryError",
            location: "com.demo.anonymize.FrameReader.next",
            errorReportCount: "7",
            distinctUsers: "3",
            firstAppVersion: { versionCode: "41" },
            lastAppVersion: { versionCode: "42" },
            lastErrorReportTime: new Date(now - 6 * DAY).toISOString(),
          },
          {
            name: "apps/demo/errorIssues/demo-anr",
            type: "ANR",
            cause: "Input dispatching timed out",
            location: "com.demo.MainActivity",
            errorReportCount: "2",
            distinctUsers: "2",
            firstAppVersion: { versionCode: "43" },
            lastAppVersion: { versionCode: "43" },
            lastErrorReportTime: new Date(now - DAY).toISOString(),
          },
        ],
        samples: {
          "demo-oom": {
            reportText:
              "java.lang.OutOfMemoryError: Failed to allocate a 8294416 byte allocation\n  at com.demo.anonymize.FrameReader.next(FrameReader.java:88)\n  at com.demo.anonymize.Runner.run(Runner.java:41)",
          },
        },
      };
    },
    async reviews(now = Date.now()) {
      const review = (id, author, stars, text, daysAgo, extra = {}) => ({
        reviewId: id,
        authorName: author,
        comments: [
          {
            userComment: {
              text,
              starRating: stars,
              lastModified: ts(now - daysAgo * DAY),
              reviewerLanguage: extra.lang ?? "en",
              appVersionName: extra.version ?? "1.7.0",
              appVersionCode: extra.code ?? 43,
              device: "demo_phone",
              androidOsVersion: 35,
            },
          },
          ...(replies.has(id)
            ? [
                {
                  developerComment: {
                    text: replies.get(id),
                    lastModified: ts(now),
                  },
                },
              ]
            : extra.reply
              ? [
                  {
                    developerComment: {
                      text: extra.reply,
                      lastModified: ts(now - (daysAgo - 1) * DAY),
                    },
                  },
                ]
              : []),
        ],
      });
      return [
        review(
          "demo-r1",
          "Demo Dancer",
          5,
          "Finally I can keep my West Coast Swing figures in one place.",
          1,
        ),
        review(
          "demo-r2",
          "Demo Trainer",
          3,
          "Anonymizing a long clip closed the app on my phone.",
          4,
          {
            version: "1.6.0",
            code: 42,
            reply: "Thanks! 1.7.0 fixes the crash with long clips.",
          },
        ),
        review(
          "demo-r3",
          "Demo Tänzerin",
          4,
          "Gute App, die Karte der Sequenzen gefällt mir.",
          6,
          { lang: "de" },
        ),
      ];
    },
    async reply(reviewId, text) {
      replies.set(reviewId, text);
      return { result: { replyText: text } };
    },
    async installs() {
      return null;
    },
  };
}

module.exports = { googlePlay, demoPlay, METRIC_SETS };
