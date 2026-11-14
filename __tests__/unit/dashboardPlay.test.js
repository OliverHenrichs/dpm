const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  BAD,
  ratesView,
  tracksView,
  issuesView,
  mergeReviews,
  reviewsView,
  parseCsv,
  installsView,
  latestDaily,
  dateTime,
} = require("@/tools/dashboard/lib/playView");
const { demoPlay, googlePlay } = require("@/tools/dashboard/lib/playSources");
const { createPlay, REPLY_MAX } = require("@/tools/dashboard/lib/play");
const {
  createDashboard,
  playSource,
  PASSKEY_ROUTES,
} = require("@/tools/dashboard/server");
const { demoStore } = require("@/tools/dashboard/lib/store");

const DAY = 86_400_000;
const iso = (s) => Date.parse(s);
const row = (day, code, values) => ({
  aggregationPeriod: "DAILY",
  startTime: { year: 2026, month: 11, day },
  dimensions: [{ dimension: "versionCode", int64Value: String(code) }],
  metrics: Object.entries(values).map(([metric, v]) => ({
    metric,
    decimalValue: { value: String(v) },
  })),
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "dpm-play-"));

describe("vitals", () => {
  const names = { rate: "crashRate", perceived: "userPerceivedCrashRate" };

  it("weights each day's rate by its users, per day and per version", () => {
    const v = ratesView(
      [
        row(1, 42, {
          crashRate: 0.02,
          userPerceivedCrashRate: 0.01,
          distinctUsers: 10,
        }),
        row(1, 43, {
          crashRate: 0,
          userPerceivedCrashRate: 0,
          distinctUsers: 30,
        }),
        row(2, 43, {
          crashRate: 0.01,
          userPerceivedCrashRate: 0.01,
          distinctUsers: 10,
        }),
        row(3, 43, { crashRate: 0.5, distinctUsers: 0 }), // no users: ignored
      ],
      names,
    );
    expect(v.overall.rate).toBeCloseTo((0.2 + 0.1) / 50);
    expect(v.overall.perceived).toBeCloseTo((0.1 + 0.1) / 50);
    expect(v.days.map((d) => d.day)).toEqual(["2026-11-01", "2026-11-02"]);
    expect(v.days[0].rate).toBeCloseTo(0.2 / 40);
    // Newest version first.
    expect(v.versions.map((x) => x.versionCode)).toEqual(["43", "42"]);
    expect(v.versions[0]).toMatchObject({ userDays: 40, days: 2 });
    expect(v.versions[1].perceived).toBeCloseTo(0.01);
  });

  it("keeps only cold starts when asked", () => {
    const start = (type, value) => ({
      ...row(1, 43, { slowStartRate: value, distinctUsers: 10 }),
      dimensions: [
        { dimension: "startType", stringValue: type },
        { dimension: "versionCode", int64Value: "43" },
      ],
    });
    const v = ratesView([start("COLD", 0.2), start("WARM", 0.01)], {
      rate: "slowStartRate",
      only: { startType: "COLD" },
    });
    expect(v.overall.rate).toBeCloseTo(0.2);
    expect(v.versions[0].versionCode).toBe("43");
  });

  it("has no overall figure without users", () => {
    expect(ratesView([], names)).toEqual({
      overall: null,
      days: [],
      versions: [],
    });
  });

  it("reads the newest daily figures and writes Pacific days", () => {
    expect(
      latestDaily({
        freshnessInfo: {
          freshnesses: [
            { aggregationPeriod: "HOURLY", latestEndTime: { year: 1 } },
            {
              aggregationPeriod: "DAILY",
              latestEndTime: { year: 2026, month: 11, day: 12 },
            },
          ],
        },
      }),
    ).toEqual({ year: 2026, month: 11, day: 12 });
    // 05:00 UTC on the 14th is still the 13th in California.
    expect(dateTime(iso("2026-11-14T05:00:00Z"))).toEqual({
      year: 2026,
      month: 11,
      day: 13,
      timeZone: { id: "America/Los_Angeles" },
    });
  });

  it("knows Play's bad behavior limits", () => {
    expect(BAD).toEqual({ crash: 0.0109, anr: 0.0047 });
  });
});

describe("tracks and crash clusters", () => {
  it("names tracks the way Play sends them and skips empty ones", () => {
    const t = tracksView({
      tracks: [
        {
          displayName: "production",
          type: "Production",
          servingReleases: [{ displayName: "1.7.0", versionCodes: ["22"] }],
        },
        {
          displayName: "alpha",
          type: "Closed testing",
          servingReleases: [{ displayName: "1.5.0", versionCodes: ["20"] }],
        },
        { displayName: "instantProd", type: "Production" },
        { displayName: "beta", type: "Open testing", servingReleases: [] },
      ],
    });
    expect(t.tracks).toEqual([
      {
        track: "Production",
        type: "Production",
        releases: [{ name: "1.7.0", versionCodes: ["22"] }],
      },
      {
        track: "Closed testing (alpha)",
        type: "Closed testing",
        releases: [{ name: "1.5.0", versionCodes: ["20"] }],
      },
    ]);
    expect(t.names).toEqual({ 20: "1.5.0", 22: "1.7.0" });
  });

  it("keeps only the trace of a sample report, and only Play links", () => {
    const [a, b] = issuesView(
      [
        {
          name: "apps/x/errorIssues/abc",
          type: "CRASH",
          cause: "java.lang.OutOfMemoryError",
          errorReportCount: "7",
          distinctUsers: "3",
          lastAppVersion: { versionCode: "42" },
          issueUri: "https://play.google.com/console/issue/abc",
        },
        {
          name: "apps/x/errorIssues/def",
          type: "ANR",
          issueUri: "javascript:alert(1)",
        },
      ],
      {
        abc: {
          reportText: "trace line\n  at x",
          deviceModel: { marketingName: "Phone" },
          eventTime: "2026-11-01T00:00:00Z",
        },
      },
    );
    expect(a).toMatchObject({
      id: "abc",
      reports: 7,
      users: 3,
      lastVersion: "42",
      trace: "trace line\n  at x",
      link: "https://play.google.com/console/issue/abc",
    });
    expect(JSON.stringify(a)).not.toMatch(/Phone|2026-11-01/);
    expect(b).toMatchObject({ id: "def", trace: null, link: null });
  });
});

describe("reviews", () => {
  const now = iso("2026-11-14T12:00:00Z");
  const review = (id, daysAgo, extra = {}) => ({
    reviewId: id,
    authorName: "Demo Dancer",
    comments: [
      {
        userComment: {
          text: "Nice",
          starRating: 4,
          lastModified: { seconds: String((now - daysAgo * DAY) / 1000) },
          appVersionName: "1.7.0",
          ...extra,
        },
      },
    ],
  });

  it("keeps what Play sends, replies included, and drops a year-old one", () => {
    const kept = mergeReviews(
      {
        old: {
          id: "old",
          writtenAt: new Date(now - 400 * DAY).toISOString(),
        },
      },
      [
        review("a", 1),
        {
          ...review("b", 3),
          comments: [
            ...review("b", 3).comments,
            {
              developerComment: {
                text: "Thanks!",
                lastModified: { seconds: String(now / 1000) },
              },
            },
          ],
        },
        { reviewId: "no-text", comments: [] },
      ],
      now,
    );
    expect(Object.keys(kept).sort()).toEqual(["a", "b"]);
    expect(kept.a).toMatchObject({
      author: "Demo Dancer",
      rating: 4,
      text: "Nice",
      version: "1.7.0",
      reply: null,
    });
    expect(kept.b.reply.text).toBe("Thanks!");
    const v = reviewsView(kept, now);
    expect(v).toMatchObject({
      total: 2,
      unanswered: 1,
      lastWeek: 2,
      average: 4,
    });
    expect(v.list[0].id).toBe("a");
  });

  it("keeps a review Play no longer lists", () => {
    const first = mergeReviews({}, [review("a", 2)], now);
    expect(Object.keys(mergeReviews(first, [], now + 6 * DAY))).toEqual(["a"]);
  });

  it("keeps the original text when Play translated it", () => {
    const kept = mergeReviews(
      {},
      [review("a", 1, { text: "Good app", originalText: "Gute App" })],
      now,
    );
    expect(kept.a).toMatchObject({ text: "Good app", original: "Gute App" });
  });
});

describe("installs reports", () => {
  const csv = (text) =>
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);

  it("reads Play's UTF-16 CSV, quotes included", () => {
    expect(parseCsv(csv('a,"b, c"\r\n1,"say ""hi"""\r\n'))).toEqual([
      ["a", "b, c"],
      ["1", 'say "hi"'],
    ]);
  });

  it("takes installs, uninstalls and active devices per day", () => {
    const v = installsView([
      csv(
        "Date,Package Name,Daily Device Installs,Daily Device Uninstalls,Active Device Installs\n2026-10-31,x,2,0,10\n",
      ),
      csv(
        "Date,Package Name,Daily User Installs,Daily User Uninstalls,Active Device Installs\n2026-11-01,x,3,1,12\n2026-11-02,x,1,0,13\n",
      ),
    ]);
    expect(v.days).toEqual([
      { day: "2026-10-31", installs: 2, uninstalls: 0, active: 10 },
      { day: "2026-11-01", installs: 3, uninstalls: 1, active: 12 },
      { day: "2026-11-02", installs: 1, uninstalls: 0, active: 13 },
    ]);
    expect(v.latest.active).toBe(13);
  });
});

describe("Google Play source", () => {
  it("asks the Reporting and Publisher APIs with the right paths", async () => {
    const calls = [];
    const google = {
      get: async (url) => {
        calls.push(["GET", url]);
        if (url.endsWith("crashRateMetricSet"))
          return {
            freshnessInfo: {
              freshnesses: [
                {
                  aggregationPeriod: "DAILY",
                  latestEndTime: { year: 2026, month: 11, day: 12 },
                },
              ],
            },
          };
        if (url.includes("/reviews?")) return { reviews: [{ reviewId: "r" }] };
        if (url.includes("errorIssues:search"))
          return { errorIssues: [{ name: "apps/p/errorIssues/i1" }] };
        if (url.includes("errorReports:search"))
          return { errorReports: [{ reportText: "t" }] };
        return {};
      },
      post: async (url, body) => {
        calls.push(["POST", url, body]);
        return { rows: [] };
      },
      bytes: async () => Buffer.alloc(0),
    };
    const play = googlePlay(google, "com.example.app");
    const now = iso("2026-11-14T12:00:00Z");
    const v = await play.vitals(now);
    expect(v.crash).toEqual({ rows: [] });
    const q = calls.find(
      ([m, u]) => m === "POST" && u.endsWith("crashRateMetricSet:query"),
    );
    expect(q[1]).toBe(
      "https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.example.app/crashRateMetricSet:query",
    );
    expect(q[2].timelineSpec).toEqual({
      aggregationPeriod: "DAILY",
      startTime: {
        year: 2026,
        month: 10,
        day: 16,
        timeZone: { id: "America/Los_Angeles" },
      },
      endTime: {
        year: 2026,
        month: 11,
        day: 12,
        timeZone: { id: "America/Los_Angeles" },
      },
    });
    expect(q[2].dimensions).toEqual(["versionCode"]);
    // Play requires the start type for slow starts; slow frames are games-only.
    const slow = calls.find(([, u]) =>
      u.endsWith("slowStartRateMetricSet:query"),
    );
    expect(slow[2].dimensions).toEqual(["startType", "versionCode"]);
    expect(calls.some(([, u]) => u.includes("slowRendering"))).toBe(false);

    const { issues, samples } = await play.issues(now);
    expect(issues).toHaveLength(1);
    expect(samples.i1.reportText).toBe("t");
    const search = calls.find(([, u]) => u.includes("errorIssues:search"))[1];
    expect(
      new URL(search).searchParams.get("interval.startTime.timeZone.id"),
    ).toBe("UTC");
    expect(await play.reviews()).toEqual([{ reviewId: "r" }]);
    await play.reply("r 1", "Thanks");
    expect(calls.at(-1)).toEqual([
      "POST",
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.example.app/reviews/r%201:reply",
      { replyText: "Thanks" },
    ]);
    // No bucket, no installs.
    expect(await play.installs(now)).toBeNull();
  });
});

describe("Play API", () => {
  it("shows setup steps without the dpm-ops key", async () => {
    const play = createPlay({ source: null });
    await play.refresh();
    expect(play.api["GET /api/play"]()).toMatchObject({
      connected: false,
      vitals: null,
      reviews: { total: 0 },
    });
    await expect(
      play.api["POST /api/play/reply"]({ id: "x", text: "hi" }),
    ).rejects.toThrow(/Not connected/);
  });

  it("fetches everything, each part failing on its own", async () => {
    const play = createPlay({
      source: {
        ...demoPlay(),
        releases: async () => {
          throw new Error("The caller does not have permission");
        },
      },
    });
    await play.refresh();
    const s = play.api["GET /api/play"]();
    expect(s.vitals.crash.overall.perceived).toBeGreaterThan(0);
    expect(s.releases).toBeNull();
    expect(s.errors.releases).toMatch(/permission/);
    expect(s.issues.length).toBeGreaterThan(0);
    expect(s.reviews.total).toBe(3);
    expect(s.summary).toMatchObject({
      connected: true,
      unanswered: 2,
      crash: { level: "ok" },
    });
    play.stop();
  });

  it("flags a crash rate over Play's limit for Overview", async () => {
    const play = createPlay({
      source: {
        ...demoPlay(),
        vitals: async () => ({
          crash: {
            rows: [
              row(1, 43, {
                crashRate: 0.03,
                userPerceivedCrashRate: 0.02,
                distinctUsers: 5,
              }),
            ],
          },
          anr: { error: "refused" },
          slowStart: { rows: [] },
        }),
      },
    });
    await play.refresh();
    const s = play.api["GET /api/play"]();
    expect(s.summary.crash).toMatchObject({ level: "over" });
    expect(s.summary.anr).toBeNull();
    expect(s.vitalsErrors).toEqual({ anr: "refused" });
    play.stop();
  });

  it("replies, keeps the reply, and keeps reviews in its file", async () => {
    const dir = tmp();
    const play = createPlay({ source: demoPlay(), dir });
    await play.refresh();
    await expect(
      play.api["POST /api/play/reply"]({ id: "demo-r1", text: "" }),
    ).rejects.toThrow(/Write a reply/);
    await expect(
      play.api["POST /api/play/reply"]({
        id: "demo-r1",
        text: "x".repeat(REPLY_MAX + 1),
      }),
    ).rejects.toThrow(/at most 350/);
    await expect(
      play.api["POST /api/play/reply"]({ id: "nope", text: "hi" }),
    ).rejects.toThrow(/No such review/);
    const s = await play.api["POST /api/play/reply"]({
      id: "demo-r1",
      text: "Thank you!",
    });
    expect(s.reviews.list.find((r) => r.id === "demo-r1").reply.text).toBe(
      "Thank you!",
    );
    play.stop();

    const file = path.join(dir, "play-reviews.json");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    // A restart without Google still has them.
    const again = createPlay({ source: null, dir });
    expect(again.api["GET /api/play"]().reviews.total).toBe(3);
  });

  it("drops reviews kept for over a year when it starts", () => {
    const dir = tmp();
    fs.writeFileSync(
      path.join(dir, "play-reviews.json"),
      JSON.stringify({
        reviews: {
          old: { id: "old", writtenAt: "2020-01-01T00:00:00Z" },
          new: { id: "new", writtenAt: new Date().toISOString() },
        },
      }),
    );
    createPlay({ source: null, dir });
    const kept = JSON.parse(
      fs.readFileSync(path.join(dir, "play-reviews.json"), "utf8"),
    ).reviews;
    expect(Object.keys(kept)).toEqual(["new"]);
  });
});

describe("dashboard wiring", () => {
  it("serves the Play routes, and a reply needs the passkey", () => {
    const dash = createDashboard({
      store: demoStore(),
      reviews: { list: () => [], get: () => null },
      settingsFile: path.join(tmp(), "settings.json"),
      opts: { every: 5, agent: false, autoReview: false },
      review: async () => ({}),
      cases: { list: () => [] },
      log: { append: () => {}, list: () => [] },
    });
    expect(Object.keys(dash.api)).toEqual(
      expect.arrayContaining([
        "GET /api/play",
        "POST /api/play/refresh",
        "POST /api/play/reply",
      ]),
    );
    expect(PASSKEY_ROUTES.has("POST /api/play/reply")).toBe(true);
    expect(PASSKEY_ROUTES.has("GET /api/play")).toBe(false);
    dash.stop();
  });

  it("uses the dpm-ops key, the production package and the bucket name", () => {
    expect(playSource({ demo: false }, "/x", {})).toEqual({
      source: null,
      pkg: "com.teholi.DancePatternMapper",
    });
    expect(
      playSource({ demo: false }, "/x", {
        DPM_OPS_CREDENTIALS: "/nonexistent.json",
      }).setupError,
    ).toMatch(/can't read/);
    expect(playSource({ demo: true }, "/x", {}).demo).toBe(true);
  });
});
