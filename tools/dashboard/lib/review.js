/**
 * The pure half of the Reports tab: what a report looks like on
 * the dashboard, what the review agent is given, what it must answer, and
 * where a report stands. No Firebase, no files, no processes here, so the unit
 * tests can run it (`__tests__/unit/dashboardReports.test.js`).
 */

const { TAKEDOWN_OWNER } = require("../../data-removal/lib/model");

/**
 * The models a review can run on, as Claude Code's aliases (each the latest of
 * its family); "" leaves the choice to Claude Code's own default.
 */
const REVIEW_MODELS = ["", "fable", "opus", "sonnet", "haiku"];
/** Cheap and quick, and enough for checking a report against a list. */
const DEFAULT_MODEL = "haiku";

/** What an agent review may recommend, and what the operator may decide. */
const VERDICTS = ["uphold", "reject", "unclear"];
const DECISIONS = ["uphold", "reject"];

/**
 * The answer the review agent must give (`claude --json-schema`). The skill,
 * `.claude/skills/review-report/SKILL.md`, explains each field.
 */
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict",
    "confidence",
    "summary",
    "findings",
    "termsSections",
    "actions",
    "checkByHand",
    "email",
  ],
  properties: {
    verdict: { type: "string", enum: VERDICTS },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    summary: { type: "string" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "where", "evidence", "holds"],
        properties: {
          claim: { type: "string" },
          where: { type: "string" },
          evidence: { type: "string" },
          holds: { type: "string", enum: ["yes", "no", "unknown"] },
        },
      },
    },
    termsSections: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      items: { type: "string", enum: ["remove-list", "block-publisher"] },
    },
    checkByHand: { type: "array", items: { type: "string" } },
    email: {
      type: "object",
      additionalProperties: false,
      required: ["language", "subject", "body"],
      properties: {
        language: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
      },
    },
  },
};

/** A published list without its secrets, as the dashboard and the agent see it. */
function publicList(listData) {
  if (!listData) return null;
  const { list = {}, patterns = [], publishedAt } = listData;
  const videos = (refs) => (refs ?? []).map((v) => v.value).filter(Boolean);
  const modifierName = new Map(
    (list.modifiers ?? []).map((m) => [m.id, m.name]),
  );
  return {
    name: list.name ?? "",
    description: list.description ?? "",
    ...(list.dance && { dance: list.dance }),
    membersOnly: !!list.membersOnly,
    publishedAt: publishedAt ?? null,
    modifiers: (list.modifiers ?? []).map((m) => ({
      name: m.name,
      ...(m.description && { description: m.description }),
      ...(m.universal && { videos: videos(m.videoRefs) }),
    })),
    patterns: patterns.map((p) => ({
      id: p.id,
      name: p.name,
      ...(p.description && { description: p.description }),
      ...(p.tags?.length && { tags: p.tags }),
      videos: videos(p.videoRefs),
      ...(p.modifierRefs?.length && {
        withModifiers: p.modifierRefs.map((r) => ({
          modifier: modifierName.get(r.modifierId) ?? r.modifierId,
          videos: videos(r.videoRefs),
        })),
      }),
    })),
  };
}

/** Whether the list is still published, taken down by the operator, or gone. */
function listStatus(listData, ownerData) {
  if (ownerData?.ownerUid === TAKEDOWN_OWNER) return "taken-down";
  return listData ? "live" : "gone";
}

/**
 * One report as the dashboard shows it, with the list it is about. The
 * reporter's email stays in it: the operator replies to it.
 *
 * @param {{ id: string, code: string, data: Record<string, unknown> }} report
 * @param {{ list?: object | null, owner?: object | null, blockedSince?: string | null }} about
 */
function reportView(report, about = {}) {
  const ownerUid =
    about.owner && about.owner.ownerUid !== TAKEDOWN_OWNER
      ? String(about.owner.ownerUid)
      : null;
  return {
    id: report.id,
    shareCode: report.code,
    reporterUid: report.data.reporterUid ?? null,
    reason: report.data.reason,
    details: report.data.details ?? "",
    contact: report.data.contact ?? "",
    createdAt: report.data.createdAt ?? null,
    list: publicList(about.list),
    listStatus: listStatus(about.list, about.owner),
    publisherUid: ownerUid,
    publisherBlockedSince: about.blockedSince ?? null,
  };
}

/**
 * What the review agent is given. Neither the reporter's email nor any user id
 * goes to it: the email reply needs neither, and the agent reads text written
 * by strangers, so it gets nothing it could leak.
 *
 * @param {ReturnType<typeof reportView>} view
 * @param {ReturnType<typeof reportView>[]} all every report on the dashboard
 * @param {{ verdict?: string, note?: string }} [decision] the operator's, when redrafting
 */
function agentInput(view, all, decision) {
  const others = all.filter(
    (r) => r.shareCode === view.shareCode && r.id !== view.id,
  );
  return {
    report: {
      shareCode: view.shareCode,
      reason: view.reason,
      details: view.details,
      sentAt: view.createdAt,
      reporterWantsReply: !!view.contact,
    },
    list: view.list,
    listStatus: view.listStatus,
    publisherBlocked: !!view.publisherBlockedSince,
    otherReportsAboutThisList: others.map((r) => ({
      reason: r.reason,
      details: r.details,
      sentAt: r.createdAt,
    })),
    ...(decision?.verdict && {
      operatorDecision: {
        verdict: decision.verdict,
        ...(decision.note && { note: decision.note }),
      },
    }),
  };
}

/** Checks the agent's answer against REVIEW_SCHEMA's essentials. */
function validateReview(value) {
  const fail = (why) => {
    throw new Error(`The review agent's answer is not a review: ${why}`);
  };
  if (!value || typeof value !== "object") fail("not an object");
  for (const key of REVIEW_SCHEMA.required) {
    if (!(key in value)) fail(`"${key}" is missing`);
  }
  if (!VERDICTS.includes(value.verdict)) fail(`verdict "${value.verdict}"`);
  if (!Array.isArray(value.findings)) fail("findings is not a list");
  if (!value.email || typeof value.email.body !== "string") fail("no email");
  return value;
}

/**
 * The review in `claude -p --output-format json` output: `structured_output`
 * when --json-schema was honoured, else the last ```json block of `result`.
 */
function parseAgentOutput(stdout) {
  let out;
  try {
    out = JSON.parse(stdout);
  } catch {
    throw new Error(
      `The review agent did not answer in JSON: ${String(stdout).slice(0, 300)}`,
    );
  }
  if (out.is_error) {
    throw new Error(`The review agent failed: ${out.result ?? out.subtype}`);
  }
  let review = out.structured_output;
  if (!review && typeof out.result === "string") {
    const blocks = [...out.result.matchAll(/```json\s*([\s\S]*?)```/g)];
    const last = blocks.at(-1)?.[1] ?? out.result;
    try {
      review = JSON.parse(last);
    } catch {
      throw new Error(
        `The review agent's answer holds no review: ${out.result.slice(0, 300)}`,
      );
    }
  }
  return {
    review: validateReview(review),
    costUsd: out.total_cost_usd ?? null,
    // The full model names the session used, e.g. "claude-opus-5-5".
    models: Object.keys(out.modelUsage ?? {}),
  };
}

/**
 * Where a report stands: `new` (no agent review yet), `reviewing` (an agent
 * is on it or queued), `ready` (reviewed, waiting for the operator's verdict),
 * `decided` (the operator decided; the report is deleted once everything is
 * done). A review of an earlier report from the same phone (sending again
 * replaces it) does not count.
 *
 * @param {ReturnType<typeof reportView>} view
 * @param {object | undefined} saved the report's review file
 * @param {boolean} busy whether an agent run is queued or running for it
 */
function stage(view, saved, busy) {
  if (saved?.decision && saved.reportCreatedAt === view.createdAt) {
    return "decided";
  }
  if (busy) return "reviewing";
  if (saved?.review && saved.reportCreatedAt === view.createdAt) {
    return "ready";
  }
  return "new";
}

/** Reports that auto review should pick up: never reviewed, not busy, no failed run. */
function needsAutoReview(views, saved, busy) {
  return views.filter(
    (v) =>
      stage(v, saved[v.id], busy.has(v.id)) === "new" &&
      v.listStatus === "live" &&
      saved[v.id]?.failedFor !== v.createdAt,
  );
}

/** Children's safety first, then oldest first (the DSA's "timely" is per report). */
function byPriority(a, b) {
  const child = (v) => (v.reason === "child" ? 0 : 1);
  return (
    child(a) - child(b) ||
    String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
  );
}

/** A report id is a share code and a user id joined by "_". */
function looksLikeReportId(id) {
  return /^[0-9A-Z]{8}_[A-Za-z0-9]{20,128}$/.test(String(id));
}

module.exports = {
  REVIEW_MODELS,
  DEFAULT_MODEL,
  VERDICTS,
  DECISIONS,
  REVIEW_SCHEMA,
  publicList,
  listStatus,
  reportView,
  agentInput,
  validateReview,
  parseAgentOutput,
  stage,
  needsAutoReview,
  byPriority,
  looksLikeReportId,
};
