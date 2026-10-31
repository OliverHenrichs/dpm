/**
 * The Usage tab: Firestore reads, writes and deletes against Spark's daily
 * quota, live listeners and refused requests (Cloud Monitoring), whether the
 * deployed rules are master's (Firebase Rules API), and our own counts.
 *
 * Monitoring and the rules are fetched hourly and kept in memory; asking
 * Monitoring costs no Firestore reads. Our own counts read the whole
 * snapshot, so they load only when the operator asks. Only numbers are kept.
 */

const {
  dailyCounts,
  quotaView,
  gaugeView,
  requestsView,
  rulesView,
  countsView,
  accountsView,
} = require("./usageView");
const { now } = require("./http");

const HOUR = 3_600_000;

/**
 * @param {{
 *   store: ReturnType<typeof import("./store").firebaseStore>,
 *   source: ReturnType<typeof import("./usageSources").googleUsage> | null,
 *   setupError?: string | null,
 *   repoRules: () => { source: string, label: string },
 *   account?: string | null,
 *   everyMs?: number,
 *   clock?: () => number,
 * }} options `source` is null without the dpm-ops key: the tab shows setup steps.
 */
function createUsage({
  store,
  source,
  setupError = null,
  repoRules,
  account = null,
  everyMs = HOUR,
  clock = Date.now,
}) {
  const state = {
    connected: !!source,
    setupError,
    account,
    demo: !!store.demo,
    fetchedAt: null,
    nextFetchAt: null,
    monitoring: null,
    monitoringError: null,
    /** Cloud Monitoring answers only for projects with billing (Blaze). */
    monitoringNeedsBilling: false,
    rules: null,
    rulesError: null,
    counts: null,
    countsAt: null,
  };
  let timer = null;
  let running = null;

  async function fetchMonitoring() {
    const t = clock();
    const raw = await source.monitoring(t);
    return {
      quota: quotaView(
        {
          reads: dailyCounts(raw.reads, t),
          writes: dailyCounts(raw.writes, t),
          deletes: dailyCounts(raw.deletes, t),
        },
        t,
      ),
      listeners: gaugeView(raw.listeners, t),
      connections: gaugeView(raw.connections, t),
      requests: requestsView(raw.requests),
    };
  }

  async function fetchRules() {
    return rulesView(await source.deployedRules(), repoRules());
  }

  /** One fetch of both, each failing on its own. Never two at once. */
  function refresh() {
    if (!source) return Promise.resolve();
    running ??= (async () => {
      const [m, r] = await Promise.allSettled([
        fetchMonitoring(),
        fetchRules(),
      ]);
      state.monitoring = m.status === "fulfilled" ? m.value : state.monitoring;
      state.monitoringError = m.status === "rejected" ? m.reason.message : null;
      state.monitoringNeedsBilling =
        m.status === "rejected" && /requires billing/i.test(m.reason.message);
      state.rules = r.status === "fulfilled" ? r.value : state.rules;
      state.rulesError = r.status === "rejected" ? r.reason.message : null;
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

  async function loadCounts() {
    const [docs, blocks, users] = await Promise.all([
      store.snapshot({ fresh: true }),
      store.blocks(),
      store.accounts ? store.accounts() : null,
    ]);
    state.counts = countsView(docs, {
      blocked: blocks.length,
      accounts: users && accountsView(users, clock()),
      now: clock(),
    });
    state.countsAt = now();
  }

  /** What Overview needs, small enough for every poll. */
  function summary() {
    return {
      connected: state.connected,
      quota: state.monitoring?.quota
        ? {
            level: state.monitoring.quota.level,
            worst: state.monitoring.quota.worst,
            resetsAt: state.monitoring.quota.resetsAt,
            reads: state.monitoring.quota.reads.share,
            writes: state.monitoring.quota.writes.share,
            deletes: state.monitoring.quota.deletes.share,
          }
        : null,
      rulesMatch: state.rules ? state.rules.matches : null,
      fetchedAt: state.fetchedAt,
      needsBilling: state.monitoringNeedsBilling,
      error:
        (state.monitoringNeedsBilling ? null : state.monitoringError) ||
        state.rulesError ||
        null,
    };
  }

  const api = {
    "GET /api/usage": () => ({ ...state, summary: summary() }),
    "POST /api/usage/refresh": async () => {
      if (!source) return { ...state, summary: summary() };
      await refresh();
      return { ...state, summary: summary() };
    },
    "POST /api/usage/counts": async () => {
      await loadCounts();
      return { ...state, summary: summary() };
    },
  };

  return {
    api,
    refresh,
    stop: () => clearTimeout(timer),
    state,
  };
}

module.exports = { createUsage };
