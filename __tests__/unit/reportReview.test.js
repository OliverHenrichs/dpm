const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const {
  publicList,
  reportView,
  agentInput,
  parseAgentOutput,
  stage,
  needsAutoReview,
  byPriority,
  looksLikeReportId,
  REVIEW_SCHEMA,
} = require("@/tools/report-review/lib/review");
const { reviewStore } = require("@/tools/report-review/lib/reviews");
const { reviewQueue, claudeArgs } = require("@/tools/report-review/lib/agent");
const { demoStore } = require("@/tools/report-review/lib/store");
const {
  createDashboard,
  createServer,
} = require("@/tools/report-review/server");
const { makeDoc, TAKEDOWN_OWNER } = require("@/tools/data-removal/lib/model");

const CODE = "AB12CD34";
const REPORTER = "Rep0000000000000000000000001";
const PUBLISHER = "Pub0000000000000000000000001";
const ID = `${CODE}_${REPORTER}`;

const listData = {
  appToken: "secret-token",
  publishedAt: "2026-10-17T00:00:00.000Z",
  list: {
    name: "WCS Thursday",
    shareKey: "never-shown",
    modifiers: [{ id: "m1", name: "with inside turn" }],
  },
  patterns: [
    {
      id: 2,
      name: "Whip",
      description: "Emma, age 11",
      videoRefs: [{ type: "url", value: "https://youtu.be/emma" }],
      modifierRefs: [
        {
          modifierId: "m1",
          videoRefs: [{ type: "url", value: "https://youtu.be/m" }],
        },
      ],
    },
  ],
};

function report(overrides = {}) {
  return makeDoc(`reports/${ID}`, {
    shareCode: CODE,
    reporterUid: REPORTER,
    reason: "child",
    details: "My daughter Emma is named.",
    contact: "parent@example.com",
    createdAt: "2026-10-24T10:00:00.000Z",
    ...overrides,
  });
}

const review = {
  verdict: "uphold",
  confidence: "high",
  summary: "A child is named.",
  findings: [
    {
      claim: "Emma is named",
      where: 'pattern #2 "Whip" › description',
      evidence: "Emma, age 11",
      holds: "yes",
    },
  ],
  termsSections: ["§2 People"],
  actions: ["remove-list"],
  checkByHand: [],
  email: { language: "English", subject: "Your report", body: "Hello" },
};

describe("publicList", () => {
  it("keeps what a subscriber sees and drops the secrets", () => {
    const list = publicList(listData);
    expect(JSON.stringify(list)).not.toMatch(/secret-token|never-shown/);
    expect(list.patterns[0]).toEqual({
      id: 2,
      name: "Whip",
      description: "Emma, age 11",
      videos: ["https://youtu.be/emma"],
      withModifiers: [
        { modifier: "with inside turn", videos: ["https://youtu.be/m"] },
      ],
    });
  });

  it("is null for a list that is gone", () => {
    expect(publicList(null)).toBeNull();
  });
});

describe("reportView", () => {
  it("joins a report with its list, publisher and block", () => {
    const view = reportView(report(), {
      list: listData,
      owner: { ownerUid: PUBLISHER },
      blockedSince: "2026-10-20T00:00:00.000Z",
    });
    expect(view).toMatchObject({
      id: ID,
      shareCode: CODE,
      reason: "child",
      contact: "parent@example.com",
      listStatus: "live",
      publisherUid: PUBLISHER,
      publisherBlockedSince: "2026-10-20T00:00:00.000Z",
    });
  });

  it("knows a taken-down list and has no publisher for it", () => {
    const view = reportView(report(), {
      list: null,
      owner: { ownerUid: TAKEDOWN_OWNER },
    });
    expect(view.listStatus).toBe("taken-down");
    expect(view.publisherUid).toBeNull();
    expect(reportView(report(), {}).listStatus).toBe("gone");
  });
});

describe("agentInput", () => {
  const view = reportView(report(), {
    list: listData,
    owner: { ownerUid: PUBLISHER },
  });
  const other = reportView(
    makeDoc(`reports/${CODE}_Other000000000000000000001`, {
      shareCode: CODE,
      reporterUid: "Other000000000000000000001",
      reason: "consent",
      contact: "other@example.com",
      createdAt: "2026-10-25T00:00:00.000Z",
    }),
    { list: listData, owner: { ownerUid: PUBLISHER } },
  );

  it("gives the agent no email and no user id", () => {
    const text = JSON.stringify(agentInput(view, [view, other]));
    expect(text).not.toMatch(/@example\.com|Rep000|Pub000|Other000/);
    expect(agentInput(view, [view]).report.reporterWantsReply).toBe(true);
  });

  it("includes other reports about the same list, and the operator's decision", () => {
    const input = agentInput(view, [view, other], {
      verdict: "reject",
      note: "Emma is the teacher's stage name",
    });
    expect(input.otherReportsAboutThisList).toEqual([
      { reason: "consent", details: "", sentAt: "2026-10-25T00:00:00.000Z" },
    ]);
    expect(input.operatorDecision).toEqual({
      verdict: "reject",
      note: "Emma is the teacher's stage name",
    });
    expect(agentInput(view, [view])).not.toHaveProperty("operatorDecision");
  });
});

describe("parseAgentOutput", () => {
  it("takes structured output", () => {
    const out = JSON.stringify({
      structured_output: review,
      total_cost_usd: 0.4,
    });
    expect(parseAgentOutput(out)).toEqual({ review, costUsd: 0.4 });
  });

  it("falls back to the last json block of the result", () => {
    const out = JSON.stringify({
      result: `Thinking.\n\`\`\`json\n{}\n\`\`\`\nDone:\n\`\`\`json\n${JSON.stringify(review)}\n\`\`\``,
    });
    expect(parseAgentOutput(out).review).toEqual(review);
  });

  it("refuses errors and answers that are not reviews", () => {
    expect(() => parseAgentOutput("not json")).toThrow(/not answer in JSON/);
    expect(() =>
      parseAgentOutput(JSON.stringify({ is_error: true, result: "budget" })),
    ).toThrow(/failed: budget/);
    expect(() =>
      parseAgentOutput(
        JSON.stringify({ structured_output: { ...review, verdict: "maybe" } }),
      ),
    ).toThrow(/verdict/);
  });

  it("matches the schema the agent is given", () => {
    expect(REVIEW_SCHEMA.required.sort()).toEqual(Object.keys(review).sort());
  });
});

describe("stage and auto review", () => {
  const view = reportView(report(), { list: listData, owner: {} });
  const createdAt = view.createdAt;

  it("moves from new to ready to decided", () => {
    expect(stage(view, undefined, false)).toBe("new");
    expect(stage(view, undefined, true)).toBe("reviewing");
    expect(stage(view, { reportCreatedAt: createdAt, review }, false)).toBe(
      "ready",
    );
    expect(
      stage(
        view,
        { reportCreatedAt: createdAt, review, decision: { verdict: "uphold" } },
        false,
      ),
    ).toBe("decided");
  });

  it("starts over when the same phone sends the report again", () => {
    const old = { reportCreatedAt: "2026-01-01T00:00:00.000Z", review };
    expect(stage(view, old, false)).toBe("new");
  });

  it("auto-reviews only new, live reports that have not failed", () => {
    const gone = { ...view, id: "X", listStatus: "gone" };
    const failed = { ...view, id: "Y" };
    const busy = { ...view, id: "Z" };
    const picked = needsAutoReview(
      [view, gone, failed, busy],
      { Y: { failedFor: createdAt } },
      new Set(["Z"]),
    );
    expect(picked.map((v) => v.id)).toEqual([ID]);
  });

  it("puts children's safety first, then the oldest", () => {
    const a = { reason: "spam", createdAt: "2026-10-01" };
    const b = { reason: "child", createdAt: "2026-10-20" };
    const c = { reason: "spam", createdAt: "2026-09-01" };
    expect([a, b, c].sort(byPriority)).toEqual([b, c, a]);
  });

  it("recognises report ids", () => {
    expect(looksLikeReportId(ID)).toBe(true);
    expect(looksLikeReportId("../etc/passwd")).toBe(false);
  });
});

describe("claudeArgs", () => {
  it("gives the agent read access to the report and the terms, and only video hosts", () => {
    const args = claudeArgs("/tmp/dpm-report-x/report.json", {});
    expect(args).toContain("/review-report /tmp/dpm-report-x/report.json");
    expect(args[args.indexOf("--tools") + 1]).toBe("Read,WebFetch,Skill");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("dontAsk");
    expect(args).toContain("Read(//tmp/dpm-report-x/report.json)");
    expect(args).toContain("Read(./.env)");
    expect(args.filter((a) => a.startsWith("WebFetch(")).join(" ")).toMatch(
      /youtube\.com.*vimeo\.com.*dropbox\.com/,
    );
    expect(args).not.toContain("Bash");
  });
});

describe("reviewQueue", () => {
  it("runs one at a time and ignores duplicates", async () => {
    const order = [];
    let release;
    const gate = new Promise((r) => (release = r));
    const queue = reviewQueue(async ({ id }) => {
      order.push(`start ${id}`);
      if (id === "a") await gate;
      order.push(`end ${id}`);
    });
    queue.add("a");
    queue.add("b");
    queue.add("b");
    queue.add("a");
    expect(queue.status()).toEqual({ running: "a", waiting: ["b"] });
    release();
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(["start a", "end a", "start b", "end b"]);
    expect(queue.busy().size).toBe(0);
  });
});

describe("reviewStore", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpm-reviews-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("merges updates, refuses odd ids and prunes reports that are gone", () => {
    const store = reviewStore(dir);
    store.update(ID, { review });
    store.update(ID, { decision: { verdict: "uphold" } });
    expect(store.get(ID)).toMatchObject({
      reportId: ID,
      review,
      decision: { verdict: "uphold" },
      done: [],
    });
    expect(() => store.update("../x", {})).toThrow(/Not a report id/);
    store.prune([]);
    expect(store.all()).toEqual({});
  });
});

describe("dashboard", () => {
  let dir;
  let dashboard;
  const agent = jest.fn();

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "dpm-dash-"));
    agent.mockResolvedValue({ review, costUsd: 0.1 });
    dashboard = createDashboard({
      store: demoStore(),
      reviews: reviewStore(dir),
      settingsFile: path.join(dir, "settings.json"),
      opts: { every: 5, autoReview: false },
      review: agent,
    });
    await dashboard.refresh();
  });
  afterEach(() => {
    dashboard.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const idle = () => new Promise((r) => setTimeout(r, 10));
  const state = () => dashboard.api["GET /api/state"]();
  const childReport = () => state().reports.find((r) => r.reason === "child");

  it("lists the demo reports, children's safety first", () => {
    const s = state();
    expect(s.reports).toHaveLength(3);
    expect(s.reports[0].reason).toBe("child");
    expect(s.reports.every((r) => r.stage === "new")).toBe(true);
  });

  it("auto review reviews every new report once and keeps them for a verdict", async () => {
    await dashboard.api["POST /api/settings"]({ autoReview: true });
    await idle();
    expect(agent).toHaveBeenCalledTimes(3);
    expect(state().reports.every((r) => r.stage === "ready")).toBe(true);
    await dashboard.refresh();
    await idle();
    expect(agent).toHaveBeenCalledTimes(3);
    // The agent never saw an email address.
    expect(JSON.stringify(agent.mock.calls)).not.toMatch(/@example\.com/);
  });

  it("records a verdict and redrafts with it", async () => {
    const { id } = childReport();
    dashboard.api["POST /api/review"]({ id });
    await idle();
    dashboard.api["POST /api/decision"]({
      id,
      verdict: "reject",
      note: "not a child",
    });
    expect(childReport().stage).toBe("decided");
    dashboard.api["POST /api/review"]({ id, redraft: true });
    await idle();
    expect(agent.mock.calls[1][0].operatorDecision).toEqual({
      verdict: "reject",
      note: "not a child",
    });
    expect(childReport().saved.decision.verdict).toBe("reject");
  });

  it("marks a failed review and does not retry it automatically", async () => {
    agent.mockRejectedValue(new Error("no claude"));
    await dashboard.api["POST /api/settings"]({ autoReview: true });
    await idle();
    expect(childReport().failed).toBe("no claude");
    await dashboard.refresh();
    await idle();
    expect(agent).toHaveBeenCalledTimes(3);
  });

  it("acts only when the share code or id is typed back", async () => {
    const r = childReport();
    await expect(
      dashboard.api["POST /api/action"]({
        id: r.id,
        action: "remove-list",
        confirm: "nope",
      }),
    ).rejects.toThrow(/share code/);
    await dashboard.api["POST /api/action"]({
      id: r.id,
      action: "remove-list",
      confirm: r.shareCode,
    });
    expect(childReport().listStatus).toBe("taken-down");
    // The publisher can still be blocked after the takedown.
    expect(childReport().publisherUid).toBe(r.publisherUid);
    await dashboard.api["POST /api/action"]({
      id: r.id,
      action: "block-publisher",
      confirm: r.publisherUid,
    });
    expect(childReport().publisherBlockedSince).toBeTruthy();
    await dashboard.api["POST /api/action"]({
      id: r.id,
      action: "delete-report",
      confirm: r.shareCode,
    });
    expect(state().reports.find((x) => x.id === r.id)).toBeUndefined();
  });

  it("serves the API only with the token, and only on its own host", async () => {
    const server = createServer(dashboard, { port: 0, token: "t".repeat(48) });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();
    // The server checks the Host header against the port it was told.
    server.close();
    const real = createServer(dashboard, { port, token: "t".repeat(48) });
    await new Promise((r) => real.listen(port, "127.0.0.1", r));
    const get = (headers) =>
      new Promise((resolve) => {
        http
          .get(
            { host: "127.0.0.1", port, path: "/api/state", headers },
            (res) => resolve(res.statusCode),
          )
          .end();
      });
    expect(await get({})).toBe(401);
    expect(await get({ "X-Dpm-Token": "t".repeat(48) })).toBe(200);
    expect(
      await get({ "X-Dpm-Token": "t".repeat(48), Host: `evil.test:${port}` }),
    ).toBe(403);
    await new Promise((r) => real.close(r));
  });
});
