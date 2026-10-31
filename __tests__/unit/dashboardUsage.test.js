const crypto = require("crypto");
const {
  SPARK_QUOTA,
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
} = require("@/tools/dashboard/lib/usageView");
const { demoUsage } = require("@/tools/dashboard/lib/usageSources");
const { createUsage } = require("@/tools/dashboard/lib/usage");
const { googleClient, assertion } = require("@/tools/dashboard/lib/google");
const { demoStore } = require("@/tools/dashboard/lib/store");

const iso = (s) => Date.parse(s);
const point = (end, value) => ({
  interval: { endTime: new Date(end).toISOString() },
  value: { int64Value: String(value) },
});

describe("quota day", () => {
  it("starts at midnight Pacific, summer and winter", () => {
    // PDT (UTC-7)
    expect(
      new Date(quotaDayStart(iso("2026-10-31T17:00:00Z"))).toISOString(),
    ).toBe("2026-10-31T07:00:00.000Z");
    // Just before midnight Pacific is still the day before.
    expect(
      new Date(quotaDayStart(iso("2026-10-31T06:59:00Z"))).toISOString(),
    ).toBe("2026-10-30T07:00:00.000Z");
    // PST (UTC-8)
    expect(
      new Date(quotaDayStart(iso("2026-12-01T12:00:00Z"))).toISOString(),
    ).toBe("2026-12-01T08:00:00.000Z");
  });

  it("resets at the next midnight, across a DST change", () => {
    // DST ends on 1 November 2026: that day starts in PDT, the next in PST.
    expect(
      new Date(quotaReset(iso("2026-11-01T12:00:00Z"))).toISOString(),
    ).toBe("2026-11-02T08:00:00.000Z");
    expect(
      new Date(quotaReset(iso("2026-10-31T17:00:00Z"))).toISOString(),
    ).toBe("2026-11-01T07:00:00.000Z");
  });
});

describe("Monitoring figures", () => {
  const now = iso("2026-10-31T09:30:00Z"); // 02:30 Pacific
  const series = [
    {
      // newest first, as Monitoring sends them
      points: [
        point(iso("2026-10-31T09:30:00Z"), 5),
        point(iso("2026-10-31T08:05:00Z"), 7),
        point(iso("2026-10-31T07:00:00Z"), 100), // the last 5 minutes of yesterday
        point(iso("2026-10-30T12:00:00Z"), 50),
        point(iso("2026-10-29T12:00:00Z"), 999), // the day before yesterday
      ],
    },
    { points: [point(iso("2026-10-31T07:10:00Z"), 3)] },
  ];

  it("splits deltas into today by hour and yesterday", () => {
    expect(dailyCounts(series, now)).toEqual({
      today: 15,
      yesterday: 150,
      hours: [3, 7, 5],
    });
  });

  it("measures today against Spark's quota and warns from 80%", () => {
    const counts = (today) => ({ today, yesterday: 0, hours: [] });
    const ok = quotaView(
      { reads: counts(100), writes: counts(0), deletes: counts(0) },
      now,
    );
    expect(ok.level).toBe("ok");
    expect(ok.reads.limit).toBe(SPARK_QUOTA.reads);
    expect(ok.resetsAt).toBe("2026-11-01T07:00:00.000Z");
    const warn = quotaView(
      { reads: counts(0), writes: counts(16_000), deletes: counts(0) },
      now,
    );
    expect(warn).toMatchObject({ level: "warn", worst: 0.8 });
    expect(
      quotaView(
        { reads: counts(50_000), writes: counts(0), deletes: counts(0) },
        now,
      ).level,
    ).toBe("over");
  });

  it("takes a gauge's latest value and today's peak", () => {
    const g = gaugeView(
      [
        {
          points: [
            point(iso("2026-10-31T09:25:00Z"), 4),
            point(iso("2026-10-31T08:00:00Z"), 9),
          ],
        },
        { points: [point(iso("2026-10-31T09:25:00Z"), 1)] },
      ],
      now,
    );
    expect(g).toMatchObject({ now: 5, peakToday: 9 });
  });

  it("counts refused requests by method", () => {
    const r = requestsView([
      {
        metric: { labels: { response_code: "OK", api_method: "Listen" } },
        points: [point(now, 40)],
      },
      {
        metric: {
          labels: { response_code: "PERMISSION_DENIED", api_method: "Commit" },
        },
        points: [point(now, 3)],
      },
      {
        metric: {
          labels: {
            response_code: "permission_denied",
            api_method: "RunQuery",
          },
        },
        points: [point(now, 1)],
      },
    ]);
    expect(r.total).toBe(44);
    expect(r.refusedTotal).toBe(4);
    expect(r.refused).toEqual([
      { name: "Commit", count: 3 },
      { name: "RunQuery", count: 1 },
    ]);
  });
});

describe("rules check", () => {
  it("ignores line endings and trailing spaces", () => {
    expect(
      rulesView(
        { source: "a\r\nb  \r\n" },
        { source: "a\nb\n", label: "master" },
      ).matches,
    ).toBe(true);
  });

  it("shows what deploying would add and remove", () => {
    const r = rulesView(
      {
        source: "1\n2\nold\n4\n5\n6\n7\n8\n9",
        updateTime: "2026-10-01T00:00:00Z",
        rulesetName: "projects/p/rulesets/abc",
      },
      { source: "1\n2\nnew\n4\n5\n6\n7\n8\n9", label: "master at 1234567" },
    );
    expect(r).toMatchObject({
      matches: false,
      added: 1,
      removed: 1,
      ruleset: "abc",
    });
    expect(r.diff.map((d) => d.op)).toEqual([
      " ",
      " ",
      "-",
      "+",
      " ",
      " ",
      "…",
    ]);
  });

  it("keeps context around each change only", () => {
    const d = lineDiff("a\nb\nc\nd\ne\nf\ng\nh", "a\nb\nc\nd\ne\nf\ng\nH", {
      context: 1,
    });
    expect(d).toEqual([
      { op: "…" },
      { op: " ", line: "g" },
      { op: "-", line: "h" },
      { op: "+", line: "H" },
    ]);
  });
});

describe("own counts", () => {
  it("counts the snapshot and keeps nothing but numbers", async () => {
    const docs = await demoStore().snapshot();
    const c = countsView(docs, {
      blocked: 2,
      now: iso("2026-10-25T12:00:00Z"),
    });
    expect(c).toMatchObject({
      lists: 2,
      membersOnly: 0,
      takedowns: 1,
      subscribers: 1,
      members: 1,
      suggestions: 1,
      suggestionsThisWeek: 1,
      reports: 3,
      blocked: 2,
      reads: docs.length,
    });
    expect(c.perDay.suggestions.find((d) => d.day === "2026-10-20").count).toBe(
      1,
    );
    expect(c.perDay.published).toHaveLength(14);
    expect(JSON.stringify(c)).not.toMatch(
      /Jonas|Demo(Publisher|Student)|secret|parent@/,
    );
  });

  it("counts accounts that are new or idle for a year", () => {
    const now = iso("2026-10-31T00:00:00Z");
    expect(
      accountsView(
        [
          {
            created: "2026-10-30T00:00:00Z",
            lastActive: "2026-10-30T00:00:00Z",
          },
          {
            created: "2024-01-01T00:00:00Z",
            lastActive: "2025-01-01T00:00:00Z",
          },
          { created: "2024-01-01T00:00:00Z", lastActive: null },
        ],
        now,
      ),
    ).toEqual({ total: 3, newThisWeek: 1, idleYear: 2 });
  });
});

describe("Usage API", () => {
  const repoRules = () => ({
    source: "rules_version = '2';",
    label: "master at abc",
  });

  it("shows setup steps without the dpm-ops key, and still counts", async () => {
    const usage = createUsage({ store: demoStore(), source: null, repoRules });
    await usage.refresh();
    const s = usage.api["GET /api/usage"]();
    expect(s).toMatchObject({
      connected: false,
      monitoring: null,
      rules: null,
    });
    const c = await usage.api["POST /api/usage/counts"]();
    expect(c.counts.lists).toBe(2);
    expect(c.counts.accounts.total).toBeGreaterThan(0);
    usage.stop();
  });

  it("fetches Monitoring and the rules, each failing on its own", async () => {
    const source = {
      ...demoUsage(),
      deployedRules: async () => {
        throw new Error("Firebase Rules API has not been used in project");
      },
    };
    const usage = createUsage({ store: demoStore(), source, repoRules });
    await usage.refresh();
    const s = usage.api["GET /api/usage"]();
    expect(s.monitoring.quota.reads.today).toBeGreaterThan(0);
    expect(s.rules).toBeNull();
    expect(s.rulesError).toMatch(/Rules API/);
    expect(s.summary).toMatchObject({ connected: true, rulesMatch: null });
    usage.stop();
  });

  it("reports drift in the summary for Overview", async () => {
    const usage = createUsage({
      store: demoStore(),
      source: {
        ...demoUsage(),
        deployedRules: async () => ({
          source: "old",
          updateTime: null,
          rulesetName: "x",
        }),
      },
      repoRules,
    });
    await usage.refresh();
    expect(usage.api["GET /api/usage"]().summary.rulesMatch).toBe(false);
    usage.stop();
  });
});

describe("Google client", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const key = {
    type: "service_account",
    client_email: "dpm-ops@example.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    private_key_id: "k1",
    project_id: "example",
  };

  it("signs a read-only token request with the key", () => {
    const jwt = assertion(key, iso("2026-10-31T00:00:00Z"));
    const [head, body, sig] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url"));
    expect(claims.iss).toBe(key.client_email);
    expect(claims.scope).toBe(
      "https://www.googleapis.com/auth/monitoring.read https://www.googleapis.com/auth/firebase.readonly",
    );
    expect(claims.exp - claims.iat).toBe(3600);
    expect(
      crypto
        .createVerify("RSA-SHA256")
        .update(`${head}.${body}`)
        .verify(publicKey, Buffer.from(sig, "base64url")),
    ).toBe(true);
  });

  it("reuses its token and passes Google's error message on", async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push(url);
      if (url.includes("oauth2")) {
        return {
          ok: true,
          json: async () => ({ access_token: "t", expires_in: 3600 }),
        };
      }
      if (url.includes("bad")) {
        return {
          ok: false,
          status: 403,
          json: async () => ({
            error: { message: "Permission denied on project" },
          }),
        };
      }
      expect(init.headers.Authorization).toBe("Bearer t");
      return { ok: true, json: async () => ({ fine: true }) };
    };
    const g = googleClient(key, { fetch: fetchFn });
    expect(await g.get("https://example.test/ok")).toEqual({ fine: true });
    await expect(g.get("https://example.test/bad")).rejects.toThrow(
      "Permission denied on project",
    );
    expect(calls.filter((u) => u.includes("oauth2"))).toHaveLength(1);
  });
});
