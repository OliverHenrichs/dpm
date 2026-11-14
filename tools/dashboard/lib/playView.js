/**
 * Pure: Google Play's answers (Play Developer Reporting API, Android
 * Publisher API, bulk report CSVs) turned into the Play tab's figures. No
 * I/O, so the tests feed it Google-shaped data directly.
 *
 * Shapes: https://developers.google.com/play/developer/reporting/reference/rest
 * and https://developers.google.com/android-publisher/api-ref/rest/v3/reviews.
 */

/**
 * Play's "bad behavior" thresholds for the user-perceived rates, over 28
 * days, above which Play may show the app less and warn users on its store
 * page.
 */
const BAD = { crash: 0.0109, anr: 0.0047 };

const DAY = 86_400_000;
/** Reviews are kept a year after they last changed (privacy policy §6). */
const REVIEW_KEEP_MS = 365 * DAY;

/** A Reporting API DateTime ({ year, month, day }) as "YYYY-MM-DD". */
function dayOf(dt) {
  if (!dt?.year) return null;
  return `${dt.year}-${String(dt.month).padStart(2, "0")}-${String(dt.day ?? 1).padStart(2, "0")}`;
}

/** A day as the API's DateTime, in the time zone Play's daily figures use. */
function dateTime(t, timeZone = "America/Los_Angeles") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, Number(x.value)]),
  );
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    timeZone: { id: timeZone },
  };
}

/** The newest day a metric set has daily figures for, from its `get`. */
function latestDaily(info) {
  const f = (info?.freshnessInfo?.freshnesses ?? []).find(
    (x) => x.aggregationPeriod === "DAILY",
  );
  return f?.latestEndTime ?? null;
}

const decimal = (m) => {
  const v = Number(m?.decimalValue?.value ?? m?.value);
  return Number.isFinite(v) ? v : null;
};
const dim = (row, name) => {
  const d = (row.dimensions ?? []).find((x) => x.dimension === name);
  return d ? String(d.int64Value ?? d.stringValue ?? "") : null;
};
const metric = (row, name) =>
  decimal((row.metrics ?? []).find((x) => x.metric === name));

/**
 * One metric set's daily rows (with the `versionCode` dimension) as a rate
 * per day and per version, each weighted by distinct users.
 *
 * @param {object[]} rows MetricsRow[]
 * @param {{ rate: string, perceived?: string, only?: Record<string, string> }} names
 *   the metrics to read, and dimension values to keep (slow starts: COLD only)
 */
function ratesView(rows, { rate, perceived, only = {} }) {
  const days = new Map();
  const versions = new Map();
  const add = (map, key, r, p, users) => {
    const e = map.get(key) ?? { users: 0, rate: 0, perceived: 0, days: 0 };
    e.users += users;
    e.rate += (r ?? 0) * users;
    e.perceived += (p ?? 0) * users;
    e.days += 1;
    map.set(key, e);
  };
  for (const row of rows ?? []) {
    const day = dayOf(row.startTime);
    const users = metric(row, "distinctUsers") ?? 0;
    if (!day || !users) continue;
    if (Object.entries(only).some(([d, v]) => dim(row, d) !== v)) continue;
    const r = metric(row, rate);
    const p = perceived ? metric(row, perceived) : null;
    add(days, day, r, p, users);
    add(versions, dim(row, "versionCode") ?? "?", r, p, users);
  }
  const out = (e) => ({
    rate: e.users ? e.rate / e.users : null,
    perceived: perceived && e.users ? e.perceived / e.users : null,
    // Distinct users are counted per day, so this sums user-days.
    userDays: e.users,
  });
  const all = [...days.values()].reduce(
    (a, e) => ({
      users: a.users + e.users,
      rate: a.rate + e.rate,
      perceived: a.perceived + e.perceived,
    }),
    { users: 0, rate: 0, perceived: 0 },
  );
  return {
    overall: all.users ? out(all) : null,
    days: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, e]) => ({ day, ...out(e) })),
    versions: [...versions.entries()]
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([versionCode, e]) => ({ versionCode, ...out(e), days: e.days })),
  };
}

/** Which release is on which track, and a version code → name lookup. */
function tracksView(options) {
  const names = {};
  const tracks = (options?.tracks ?? [])
    .map((t) => ({
      // Play sends the track id ("alpha") as displayName and its kind
      // ("Closed testing") as type.
      track:
        t.type && t.displayName && t.type.toLowerCase() !== t.displayName
          ? `${t.type} (${t.displayName})`
          : t.type || t.displayName || "?",
      type: t.type ?? null,
      releases: (t.servingReleases ?? []).map((r) => {
        const codes = (r.versionCodes ?? []).map(String);
        for (const c of codes) names[c] ??= r.displayName;
        return { name: r.displayName ?? "?", versionCodes: codes };
      }),
    }))
    // Tracks serving nothing (instant apps, unused open testing) are noise.
    .filter((t) => t.releases.length > 0);
  return { tracks, names };
}

/** The top crash and ANR clusters, each with one sample stack trace if given. */
function issuesView(issues, samples = {}) {
  return (issues ?? []).map((i) => {
    const id = String(i.name ?? "")
      .split("/")
      .pop();
    const report = samples[id];
    return {
      id,
      type: i.type ?? "?",
      cause: i.cause ?? "",
      location: i.location ?? "",
      reports: Number(i.errorReportCount ?? 0),
      users: Number(i.distinctUsers ?? 0),
      firstVersion: i.firstAppVersion?.versionCode ?? null,
      lastVersion: i.lastAppVersion?.versionCode ?? null,
      lastSeen: i.lastErrorReportTime ?? null,
      link: /^https:\/\/play\.google\.com\//.test(i.issueUri ?? "")
        ? i.issueUri
        : null,
      // Only the trace: the report's device and time stay with Google.
      trace: report?.reportText
        ? String(report.reportText).split("\n").slice(0, 40).join("\n")
        : null,
    };
  });
}

const ms = (ts) => {
  if (!ts) return null;
  const s = Number(ts.seconds ?? 0);
  return Number.isFinite(s)
    ? s * 1000 + Math.floor((ts.nanos ?? 0) / 1e6)
    : null;
};

/** One Android Publisher review as we keep it. */
function reviewRecord(r, fetchedAt) {
  const user = (r.comments ?? []).find((c) => c.userComment)?.userComment;
  const dev = (r.comments ?? []).find(
    (c) => c.developerComment,
  )?.developerComment;
  if (!r.reviewId || !user) return null;
  const at = ms(user.lastModified);
  return {
    id: String(r.reviewId),
    author: r.authorName || "A Google user",
    rating: Number(user.starRating) || null,
    text: String(user.text ?? "").trim(),
    original:
      user.originalText && user.originalText !== user.text
        ? String(user.originalText).trim()
        : null,
    language: user.reviewerLanguage ?? null,
    version: user.appVersionName ?? null,
    versionCode: user.appVersionCode ? String(user.appVersionCode) : null,
    device: user.deviceMetadata?.productName || user.device || null,
    android: user.androidOsVersion ?? null,
    writtenAt: at ? new Date(at).toISOString() : null,
    reply: dev
      ? {
          text: String(dev.text ?? ""),
          at: ms(dev.lastModified)
            ? new Date(ms(dev.lastModified)).toISOString()
            : null,
        }
      : null,
    fetchedAt,
  };
}

/**
 * The kept reviews with a fetch merged in, minus any not changed for a year.
 *
 * @param {Record<string, object>} kept by review id
 * @param {object[]} fetched Android Publisher Review[]
 */
function mergeReviews(kept, fetched, now) {
  const at = new Date(now).toISOString();
  const out = { ...kept };
  for (const r of fetched ?? []) {
    const rec = reviewRecord(r, at);
    if (rec) out[rec.id] = rec;
  }
  for (const [id, r] of Object.entries(out)) {
    const t = Date.parse(r.writtenAt ?? r.fetchedAt);
    if (!(now - t < REVIEW_KEEP_MS)) delete out[id];
  }
  return out;
}

/** Reviews newest first, with the counts the tab and Overview show. */
function reviewsView(kept, now) {
  const list = Object.values(kept ?? {}).sort((a, b) =>
    String(b.writtenAt).localeCompare(String(a.writtenAt)),
  );
  const rated = list.filter((r) => r.rating);
  const stars = [1, 2, 3, 4, 5].map(
    (s) => rated.filter((r) => r.rating === s).length,
  );
  return {
    list,
    total: list.length,
    unanswered: list.filter((r) => !r.reply).length,
    lastWeek: list.filter((r) => now - Date.parse(r.writtenAt) < 7 * DAY)
      .length,
    average: rated.length
      ? rated.reduce((a, r) => a + r.rating, 0) / rated.length
      : null,
    stars,
  };
}

/** A UTF-16 (or UTF-8) CSV from Play's bulk reports, as rows of strings. */
function parseCsv(buf) {
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe)
    text = buf.subarray(2).toString("utf16le");
  else if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    text = swapped.toString("utf16le");
  } else text = buf.toString("utf8").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

/** Columns we show, by the first header that matches (Play renamed them over time). */
const INSTALL_COLUMNS = {
  installs: [
    /^daily user installs$/i,
    /^daily device installs$/i,
    /^install events$/i,
  ],
  uninstalls: [
    /^daily user uninstalls$/i,
    /^daily device uninstalls$/i,
    /^uninstall events$/i,
  ],
  active: [/^active device installs$/i, /^total user installs$/i],
};

/** The installs overview CSVs (one per month) as figures per day. */
function installsView(csvs) {
  const days = new Map();
  for (const buf of csvs ?? []) {
    const [head, ...rows] = parseCsv(buf);
    if (!head) continue;
    const col = (patterns) => {
      for (const p of patterns) {
        const i = head.findIndex((h) => p.test(h.trim()));
        if (i >= 0) return i;
      }
      return -1;
    };
    const di = head.findIndex((h) => /^date$/i.test(h.trim()));
    const idx = Object.fromEntries(
      Object.entries(INSTALL_COLUMNS).map(([k, p]) => [k, col(p)]),
    );
    if (di < 0) continue;
    for (const r of rows) {
      const day = r[di]?.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const n = (i) => (i >= 0 && r[i] !== "" ? Number(r[i]) || 0 : null);
      days.set(day, {
        day,
        installs: n(idx.installs),
        uninstalls: n(idx.uninstalls),
        active: n(idx.active),
      });
    }
  }
  const list = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  return { days: list.slice(-60), latest: list.at(-1) ?? null };
}

module.exports = {
  BAD,
  REVIEW_KEEP_MS,
  dayOf,
  dateTime,
  latestDaily,
  ratesView,
  tracksView,
  issuesView,
  reviewRecord,
  mergeReviews,
  reviewsView,
  parseCsv,
  installsView,
};
