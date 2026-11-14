/**
 * The Play tab: Android vitals per version (crashes, ANRs, slow starts, slow
 * frames), the biggest crash clusters, which release each track serves,
 * installs from Play's monthly reports, and the reviews, with a reply box.
 *
 * Fetched when the dashboard starts and then daily (Play's figures change
 * once a day, and it lists reviews for about a week). Figures stay in
 * memory; the reviews are kept in a file for a year after they last changed
 * (privacy policy §6), so none are lost between fetches.
 */

const path = require("path");
const {
  BAD,
  ratesView,
  tracksView,
  issuesView,
  mergeReviews,
  reviewsView,
  installsView,
} = require("./playView");
const { METRIC_SETS } = require("./playSources");
const { now, httpError, readJson, writeJson } = require("./http");

const DAY = 86_400_000;
/** Google Play rejects longer replies. */
const REPLY_MAX = 350;

/**
 * @param {{
 *   source: ReturnType<typeof import("./playSources").googlePlay> | null,
 *   dir?: string | null,
 *   setupError?: string | null,
 *   account?: string | null,
 *   pkg?: string | null,
 *   bucket?: string | null,
 *   demo?: boolean,
 *   everyMs?: number,
 *   clock?: () => number,
 * }} options `source` is null without the dpm-ops key: the tab shows setup steps.
 *   `dir` holds the kept reviews (none kept without it).
 */
function createPlay({
  source,
  dir = null,
  setupError = null,
  account = null,
  pkg = null,
  bucket = null,
  demo = false,
  everyMs = DAY,
  clock = Date.now,
}) {
  const file = dir && path.join(dir, "play-reviews.json");
  let kept = (file && readJson(file)?.reviews) || {};
  const state = {
    connected: !!source,
    setupError,
    account,
    pkg,
    bucket: !!bucket,
    demo,
    fetchedAt: null,
    nextFetchAt: null,
    vitals: null,
    vitalsErrors: {},
    releases: null,
    issues: null,
    installs: null,
    errors: {},
  };
  let timer = null;
  let running = null;

  const save = () => {
    if (file) writeJson(file, { reviews: kept });
  };
  // Drop reviews older than a year even if Google can't be reached.
  const pruned = mergeReviews(kept, [], clock());
  if (Object.keys(pruned).length !== Object.keys(kept).length) {
    kept = pruned;
    save();
  }

  async function fetchVitals() {
    const raw = await source.vitals(clock());
    const names = {
      crash: { rate: "crashRate", perceived: "userPerceivedCrashRate" },
      anr: { rate: "anrRate", perceived: "userPerceivedAnrRate" },
      slowStart: { rate: "slowStartRate" },
      slowRendering: { rate: "slowRenderingRate30Fps" },
    };
    const out = {};
    const errors = {};
    for (const k of Object.keys(METRIC_SETS)) {
      if (raw[k]?.error) errors[k] = raw[k].error;
      else out[k] = ratesView(raw[k]?.rows, names[k]);
    }
    return { vitals: out, errors };
  }

  async function fetchReviews() {
    kept = mergeReviews(kept, await source.reviews(clock()), clock());
    save();
  }

  /** Everything once, each part failing on its own. Never two at once. */
  function refresh() {
    if (!source) return Promise.resolve();
    running ??= (async () => {
      const parts = {
        vitals: fetchVitals(),
        releases: source.releases(),
        issues: source.issues(clock()),
        reviews: fetchReviews(),
        installs: source.installs(clock()),
      };
      const keys = Object.keys(parts);
      const settled = await Promise.allSettled(Object.values(parts));
      const errors = {};
      keys.forEach((k, i) => {
        const r = settled[i];
        if (r.status === "rejected") {
          errors[k] = r.reason.message;
          return;
        }
        if (k === "vitals") {
          state.vitals = r.value.vitals;
          state.vitalsErrors = r.value.errors;
        }
        if (k === "releases") state.releases = tracksView(r.value);
        if (k === "issues")
          state.issues = issuesView(r.value.issues, r.value.samples);
        if (k === "installs")
          state.installs = r.value ? installsView(r.value) : null;
      });
      state.errors = errors;
      state.fetchedAt = now();
    })().finally(() => {
      running = null;
      schedule();
    });
    return running;
  }

  function schedule() {
    clearTimeout(timer);
    if (!source) return;
    state.nextFetchAt = new Date(clock() + everyMs).toISOString();
    timer = setTimeout(refresh, everyMs);
    timer.unref?.();
  }

  /** The newest version with figures, and how its rates compare with Play's limits. */
  function summary() {
    const latest = (v) => v?.versions?.[0] ?? null;
    const crash = state.vitals?.crash;
    const anr = state.vitals?.anr;
    const level = (rate, bad) =>
      rate == null
        ? null
        : rate >= bad
          ? "over"
          : rate >= bad * 0.8
            ? "warn"
            : "ok";
    const reviews = reviewsView(kept, clock());
    return {
      connected: state.connected,
      fetchedAt: state.fetchedAt,
      crash: crash?.overall
        ? {
            perceived: crash.overall.perceived,
            level: level(crash.overall.perceived, BAD.crash),
            latest: latest(crash),
          }
        : null,
      anr: anr?.overall
        ? {
            perceived: anr.overall.perceived,
            level: level(anr.overall.perceived, BAD.anr),
            latest: latest(anr),
          }
        : null,
      unanswered: reviews.unanswered,
      reviewsLastWeek: reviews.lastWeek,
      error: Object.values(state.errors)[0] ?? null,
    };
  }

  const view = () => ({
    ...state,
    bad: BAD,
    reviews: reviewsView(kept, clock()),
    replyMax: REPLY_MAX,
    summary: summary(),
  });

  const api = {
    "GET /api/play": view,
    "POST /api/play/refresh": async () => {
      await refresh();
      return view();
    },
    /** Publishes a reply under a review on Google Play: public, so the page asks first. */
    "POST /api/play/reply": async ({ id, text } = {}) => {
      if (!source) throw httpError(400, "Not connected to Google Play.");
      const review = kept[String(id ?? "")];
      if (!review) throw httpError(404, "No such review.");
      const reply = String(text ?? "").trim();
      if (!reply) throw httpError(400, "Write a reply first.");
      if (reply.length > REPLY_MAX)
        throw httpError(
          400,
          `Google Play takes at most ${REPLY_MAX} characters (this has ${reply.length}).`,
        );
      const res = await source.reply(review.id, reply);
      kept[review.id] = {
        ...review,
        reply: {
          text: res?.result?.replyText ?? reply,
          at: res?.result?.lastEdited?.seconds
            ? new Date(
                Number(res.result.lastEdited.seconds) * 1000,
              ).toISOString()
            : now(),
        },
      };
      save();
      return view();
    },
  };

  return { api, refresh, stop: () => clearTimeout(timer), state, summary };
}

module.exports = { createPlay, REPLY_MAX };
