/**
 * The pure half of the Usage tab: Spark's daily quota day, turning Cloud
 * Monitoring time series into hourly figures, comparing rules, and counting
 * our own Firestore documents. No network here, so the unit tests run it
 * (`__tests__/unit/dashboardUsage.test.js`).
 */

const { TAKEDOWN_OWNER } = require("../../data-removal/lib/model");

/**
 * Spark's free daily Firestore quota. Going over stops reads or writes for
 * everyone until the quota day ends at midnight Pacific time.
 * https://firebase.google.com/docs/firestore/quotas#free-quota
 */
const SPARK_QUOTA = { reads: 50_000, writes: 20_000, deletes: 20_000 };
const QUOTA_ZONE = "America/Los_Angeles";
/** From here the quota card warns. */
const WARN_AT = 0.8;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Minutes `zone` is ahead of UTC at `t`. */
function zoneOffset(t, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60_000);
}

/** When the quota day that holds `t` began (midnight in `zone`), as epoch ms. */
function quotaDayStart(t, zone = QUOTA_ZONE) {
  const local = t + zoneOffset(t, zone) * 60_000;
  const midnightLocal = Math.floor(local / DAY) * DAY;
  // The offset at midnight can differ from now's on a DST change day.
  let start = midnightLocal - zoneOffset(midnightLocal, zone) * 60_000;
  if (start > t) start -= DAY;
  return start;
}

/** The next quota reset after `t`. */
function quotaReset(t, zone = QUOTA_ZONE) {
  // 26 h later is always in the next day, whatever DST does.
  return quotaDayStart(quotaDayStart(t, zone) + 26 * HOUR, zone);
}

/** Monitoring points, oldest first, as { end: epoch ms, value: number }. */
function pointsOf(series) {
  return (series?.points ?? [])
    .map((p) => ({
      end: Date.parse(p.interval.endTime),
      value: Number(
        p.value.int64Value ??
          p.value.doubleValue ??
          p.value.distributionValue?.count ??
          0,
      ),
    }))
    .sort((a, b) => a.end - b.end);
}

/**
 * A DELTA count (reads, writes, deletes) summed over all series, split into
 * today's quota day, hour by hour, and yesterday's total. A point counts for
 * the period that ends at its end time.
 */
function dailyCounts(seriesList, now) {
  const start = quotaDayStart(now);
  const hours = Array(25).fill(0); // 25: a DST day can have one more
  let today = 0;
  let yesterday = 0;
  for (const series of seriesList ?? []) {
    for (const p of pointsOf(series)) {
      const at = p.end - 1;
      if (at >= start) {
        today += p.value;
        hours[Math.min(24, Math.floor((at - start) / HOUR))] += p.value;
      } else if (at >= quotaDayStart(start - 1)) {
        yesterday += p.value;
      }
    }
  }
  const elapsed = Math.max(1, Math.ceil((now - start) / HOUR));
  return { today, yesterday, hours: hours.slice(0, Math.min(25, elapsed)) };
}

/** Today's figure against Spark's quota, for each of reads, writes, deletes. */
function quotaView(counts, now) {
  const start = quotaDayStart(now);
  const out = {
    dayStart: new Date(start).toISOString(),
    resetsAt: new Date(quotaReset(now)).toISOString(),
    warnAt: WARN_AT,
  };
  let worst = 0;
  for (const key of Object.keys(SPARK_QUOTA)) {
    const c = counts[key] ?? { today: 0, yesterday: 0, hours: [] };
    const share = c.today / SPARK_QUOTA[key];
    worst = Math.max(worst, share);
    out[key] = { ...c, limit: SPARK_QUOTA[key], share };
  }
  out.worst = worst;
  out.level = worst >= 1 ? "over" : worst >= WARN_AT ? "warn" : "ok";
  return out;
}

/** A GAUGE (listeners, connections): its latest value and today's peak. */
function gaugeView(seriesList, now) {
  const start = quotaDayStart(now);
  const byEnd = new Map();
  for (const series of seriesList ?? []) {
    for (const p of pointsOf(series)) {
      byEnd.set(p.end, (byEnd.get(p.end) ?? 0) + p.value);
    }
  }
  const points = [...byEnd].sort((a, b) => a[0] - b[0]);
  const last = points.at(-1);
  const peak = Math.max(
    0,
    ...points.filter(([end]) => end > start).map(([, v]) => v),
  );
  return {
    now: last ? last[1] : 0,
    at: last ? new Date(last[0]).toISOString() : null,
    peakToday: peak,
  };
}

/**
 * Requests by response code today, and the ones the rules refused by method.
 * Series come grouped by `metric.label.response_code` and `api_method`.
 */
function requestsView(seriesList) {
  const byCode = {};
  const refused = {};
  let total = 0;
  for (const s of seriesList ?? []) {
    const code = String(s.metric?.labels?.response_code ?? "unknown");
    const method = String(s.metric?.labels?.api_method ?? "unknown");
    const n = pointsOf(s).reduce((a, p) => a + p.value, 0);
    total += n;
    byCode[code] = (byCode[code] ?? 0) + n;
    if (/permission[_ ]?denied/i.test(code)) {
      refused[method] = (refused[method] ?? 0) + n;
    }
  }
  const sorted = (o) =>
    Object.entries(o)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  const refusedTotal = Object.values(refused).reduce((a, n) => a + n, 0);
  return {
    total,
    byCode: sorted(byCode),
    refused: sorted(refused),
    refusedTotal,
  };
}

const normalize = (text) =>
  String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();

/**
 * Lines that differ between two texts, with two lines of context, as
 * `{ op: " " | "-" | "+", line }` (`-` only in `a`, `+` only in `b`). Gaps
 * between hunks are `{ op: "…" }`.
 */
function lineDiff(a, b, { context = 2, max = 300 } = {}) {
  const x = normalize(a).split("\n");
  const y = normalize(b).split("\n");
  // Longest common subsequence, from the end.
  const n = x.length;
  const m = y.length;
  if (n * m > 4_000_000) return [{ op: "…" }];
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] =
        x[i] === y[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const all = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      all.push({ op: " ", line: x[i] });
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) {
      all.push({ op: "-", line: x[i++] });
    } else {
      all.push({ op: "+", line: y[j++] });
    }
  }
  const keep = all.map(() => false);
  all.forEach((d, k) => {
    if (d.op === " ") return;
    for (let c = k - context; c <= k + context; c++) {
      if (c >= 0 && c < all.length) keep[c] = true;
    }
  });
  const out = [];
  all.forEach((d, k) => {
    if (keep[k]) out.push(d);
    else if (out.at(-1)?.op !== "…") out.push({ op: "…" });
  });
  return out.slice(0, max);
}

/**
 * The deployed ruleset against the repository's.
 *
 * @param {{ source: string, updateTime?: string, rulesetName?: string }} deployed
 * @param {{ source: string, label: string }} repo
 */
function rulesView(deployed, repo) {
  const matches = normalize(deployed.source) === normalize(repo.source);
  const diff = matches ? [] : lineDiff(deployed.source, repo.source);
  return {
    matches,
    deployedAt: deployed.updateTime ?? null,
    ruleset: deployed.rulesetName?.split("/").pop() ?? null,
    against: repo.label,
    added: diff.filter((d) => d.op === "+").length,
    removed: diff.filter((d) => d.op === "-").length,
    diff,
  };
}

/** UTC day of an ISO time or Firestore timestamp-as-string, or null. */
function dayOf(value) {
  const t = typeof value === "number" ? value : Date.parse(value ?? "");
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}

/** The last `days` UTC days, oldest first, ending today. */
function lastDays(now, days) {
  const out = [];
  for (let k = days - 1; k >= 0; k--) {
    out.push(new Date(now - k * DAY).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Our own figures from one snapshot: counts only, nothing about anyone.
 *
 * @param {import("../../data-removal/lib/model").Doc[]} docs
 * @param {{ blocked: number, accounts?: { total: number, newThisWeek: number, idleYear: number } | null, now?: number, days?: number }} extra
 */
function countsView(
  docs,
  { blocked, accounts = null, now = Date.now(), days = 14 },
) {
  const of = (kind) => docs.filter((d) => d.kind === kind);
  const lists = of("list");
  const subscribers = of("subscriber");
  const suggestions = of("suggestion");
  const owners = of("owner");
  const dayKeys = lastDays(now, days);
  const perDay = (items, field) => {
    const counts = Object.fromEntries(dayKeys.map((d) => [d, 0]));
    for (const it of items) {
      const d = dayOf(it.data[field]);
      if (d in counts) counts[d]++;
    }
    return dayKeys.map((day) => ({ day, count: counts[day] }));
  };
  const week = now - 7 * DAY;
  const since = (items, field) =>
    items.filter((it) => Date.parse(it.data[field] ?? "") >= week).length;
  return {
    lists: lists.length,
    membersOnly: lists.filter((l) => l.data.list?.membersOnly === true).length,
    publishedThisWeek: since(lists, "publishedAt"),
    takedowns: owners.filter((o) => o.data.ownerUid === TAKEDOWN_OWNER).length,
    subscribers: subscribers.length,
    members: subscribers.filter((s) => s.data.membership === "member").length,
    joinRequests: subscribers.filter((s) => s.data.membership === "requested")
      .length,
    muted: subscribers.filter((s) => s.data.status === "muted").length,
    suggestions: suggestions.length,
    suggestionsThisWeek: since(suggestions, "createdAt"),
    reports: of("report").length,
    blocked,
    accounts,
    perDay: {
      published: perDay(lists, "publishedAt"),
      suggestions: perDay(suggestions, "createdAt"),
    },
    reads: docs.length,
  };
}

/**
 * Account figures from Firebase Auth's user records (creation and last
 * activity times only). "Idle" means no sign-in or token refresh for a year.
 */
function accountsView(users, now = Date.now()) {
  const week = now - 7 * DAY;
  const year = now - 365 * DAY;
  let newThisWeek = 0;
  let idleYear = 0;
  for (const u of users) {
    if (Date.parse(u.created ?? "") >= week) newThisWeek++;
    const last = Date.parse(u.lastActive ?? u.created ?? "");
    if (!(last >= year)) idleYear++;
  }
  return { total: users.length, newThisWeek, idleYear };
}

module.exports = {
  SPARK_QUOTA,
  WARN_AT,
  quotaDayStart,
  quotaReset,
  dailyCounts,
  quotaView,
  gaugeView,
  requestsView,
  lineDiff,
  rulesView,
  countsView,
  accountsView,
};
