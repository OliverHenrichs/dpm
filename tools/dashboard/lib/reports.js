/**
 * The Reports tab: every report about a published list, with the list it is
 * about, an agent's review and draft reply (the review-report skill), and the
 * operator's verdict and actions. Report notes live in `reviews.js`.
 */

const fs = require("fs");
const {
  DECISIONS,
  REVIEW_MODELS,
  DEFAULT_MODEL,
  agentInput,
  stage,
  needsAutoReview,
  byPriority,
  looksLikeReportId,
} = require("./review");
const { reviewQueue } = require("./agent");
const { httpError, now, readJson } = require("./http");

function createReports({
  store,
  reviews,
  settingsFile,
  opts,
  review,
  log = () => {},
}) {
  const saved = readJson(settingsFile) ?? {};
  const state = {
    refreshMinutes: saved.refreshMinutes ?? opts.every,
    // Agent reviews send report text to Anthropic, so they are off until the
    // operator turns them on, on the page or with --agent.
    agent: !!opts.agent || !!saved.agent,
    autoReview: !!opts.autoReview || (!!saved.agent && !!saved.autoReview),
    // Haiku unless changed on the page; "" is Claude Code's default (or
    // DPM_REVIEW_MODEL). See REVIEW_MODELS.
    model: REVIEW_MODELS.includes(saved.model) ? saved.model : DEFAULT_MODEL,
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
      const {
        review: result,
        costUsd,
        models,
      } = await review(agentInput(view, state.views, decision), {
        model: state.model,
      });
      if (!state.views.some((v) => v.id === id)) return; // deleted meanwhile
      reviews.update(id, {
        reportCreatedAt: view.createdAt,
        review: result,
        reviewedAt: new Date().toISOString(),
        costUsd,
        models: models ?? [],
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
        agent: state.agent,
        model: state.model,
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
      if (state.agent && state.autoReview) {
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
      agent: state.agent,
      model: state.model,
      models: REVIEW_MODELS,
      defaultModel: process.env.DPM_REVIEW_MODEL || null,
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

    "POST /api/settings": async ({
      refreshMinutes,
      agent,
      autoReview,
      model,
    }) => {
      if (model !== undefined) {
        if (!REVIEW_MODELS.includes(model)) {
          throw httpError(400, "Unknown model.");
        }
        state.model = model;
      }
      if (refreshMinutes !== undefined) {
        const m = Number(refreshMinutes);
        if (!(m >= 1 && m <= 24 * 60))
          throw httpError(400, "1 to 1440 minutes.");
        state.refreshMinutes = m;
        schedule();
      }
      if (agent !== undefined) state.agent = !!agent;
      if (autoReview !== undefined) state.autoReview = !!autoReview;
      // Auto review needs agent reviews; turning those off turns it off.
      if (!state.agent) state.autoReview = false;
      saveSettings();
      if (state.agent && state.autoReview) {
        needsAutoReview(state.views, reviews.all(), queue.busy()).forEach((v) =>
          queue.add(v.id),
        );
      }
      return snapshot();
    },

    /** Runs the skill; `redraft` passes the operator's verdict and note to it. */
    "POST /api/review": ({ id, redraft }) => {
      const view = viewOf(id);
      if (!state.agent) {
        throw httpError(400, "Agent reviews are off (header).");
      }
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
    "POST /api/action": async ({ id, action, confirm }, ctx = {}) => {
      const view = viewOf(id);
      if (action === "remove-list") {
        if (confirm !== view.shareCode)
          throw httpError(400, "Type the share code.");
        if (view.listStatus === "taken-down")
          throw httpError(400, "Already taken down.");
        await store.removeList(view.shareCode);
        log({ action, shareCode: view.shareCode, reportId: id, ...ctx });
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
        log({
          action: "block-user",
          uid: view.publisherUid,
          reportId: id,
          ...ctx,
        });
        record(id, action);
      } else if (action === "delete-report") {
        if (confirm !== view.shareCode)
          throw httpError(400, "Type the share code.");
        await store.deleteReport(id);
        log({ action, shareCode: view.shareCode, reportId: id, ...ctx });
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

module.exports = { createReports };
