const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  searchView,
  listView,
  userView,
  takedowns,
  planAction,
} = require("@/tools/dashboard/lib/dataView");
const { demoStore } = require("@/tools/dashboard/lib/store");
const { caseStore } = require("@/tools/dashboard/lib/cases");
const { actionLog } = require("@/tools/dashboard/lib/actionLog");
const { createAccess } = require("@/tools/dashboard/lib/access");
const { createDashboard } = require("@/tools/dashboard/server");
const { reviewStore } = require("@/tools/dashboard/lib/reviews");

const PUBLISHER = "DemoPublisher000000000000001";
const STUDENT = "DemoStudent00000000000000001";

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dpm-data-"));
}

describe("dataView", () => {
  let docs;
  beforeEach(async () => {
    docs = await demoStore().snapshot();
  });

  it("finds text anywhere and groups it by list", () => {
    const s = searchView(docs, "sneakers");
    expect(s.lists).toHaveLength(1);
    expect(s.lists[0]).toMatchObject({ code: "SPAM0001", status: "live" });
    expect(s.lists[0].hits[0].field).toBe(
      'pattern "Left side pass" › description',
    );
  });

  it("offers a share code or user id as a direct jump", () => {
    expect(searchView(docs, "WCS2026A").shareCode).toBe("WCS2026A");
    expect(searchView(docs, PUBLISHER).uid).toBe(PUBLISHER);
  });

  it("never searches or shows secrets", () => {
    expect(searchView(docs, "secret").lists).toEqual([]);
    expect(JSON.stringify(listView(docs, "WCS2026A"))).not.toMatch(/secret/);
  });

  it("shows everything under a list", () => {
    const v = listView(docs, "WCS2026A");
    expect(v).toMatchObject({
      status: "live",
      ownerUid: PUBLISHER,
      counters: 0,
    });
    expect(v.suggestions).toEqual([
      expect.objectContaining({
        id: "s1",
        name: "Left side pass",
        authorUid: STUDENT,
      }),
    ]);
    expect(v.subscribers).toEqual([
      expect.objectContaining({ uid: STUDENT, name: "Jonas" }),
    ]);
    expect(v.reports).toHaveLength(2);
    expect(listView(docs, "OLDLIST1")).toMatchObject({
      status: "taken-down",
      ownerUid: null,
    });
    expect(listView(docs, "NOTHERE1")).toBeNull();
  });

  it("shows where a user appears", () => {
    const u = userView(docs, STUDENT, { account: { uid: STUDENT } });
    expect(u.suggestions).toHaveLength(1);
    expect(u.memberships).toEqual([
      expect.objectContaining({
        code: "WCS2026A",
        listName: "WCS Thursday course",
      }),
    ]);
    expect(userView(docs, PUBLISHER).ownedLists.map((l) => l.code)).toEqual([
      "WCS2026A",
    ]);
  });

  it("lists takedowns", () => {
    expect(takedowns(docs)).toEqual([
      { code: "OLDLIST1", removedAt: "2026-09-30T12:00:00.000Z" },
    ]);
  });

  it("says what a removal will do and what to type back", () => {
    const p = planAction(docs, { action: "remove-list", code: "WCS2026A" });
    expect(p.expect).toBe("WCS2026A");
    expect(p.effects[0]).toBe(
      "Deletes the list document, 1 suggestion, 1 subscriber record",
    );
    expect(p.effects[1]).toMatch(/takedown record/);
    const again = planAction(docs, {
      action: "remove-list",
      code: "WCS2026A",
      allowRepublish: true,
    });
    expect(again.effects[0]).toMatch(/the owner record/);
  });

  it("refuses what the command line refuses", () => {
    expect(() =>
      planAction(docs, { action: "remove-list", code: "OLDLIST1" }),
    ).toThrow(/already taken down/);
    expect(() =>
      planAction(docs, { action: "release", code: "WCS2026A" }),
    ).toThrow(/not taken down/);
    expect(() =>
      planAction(
        docs,
        { action: "remove-user", uid: PUBLISHER },
        { account: {} },
      ),
    ).toThrow(/with their lists/);
    expect(() =>
      planAction(
        docs,
        { action: "block-user", uid: STUDENT },
        { blockedSince: "x" },
      ),
    ).toThrow(/already blocked/);
    expect(() =>
      planAction(docs, { action: "unblock-user", uid: STUDENT }),
    ).toThrow(/not blocked/);
  });
});

describe("Data tab", () => {
  let dir;
  let dashboard;
  let log;
  beforeEach(async () => {
    dir = tmp();
    log = actionLog(path.join(dir, "actions.jsonl"));
    dashboard = createDashboard({
      store: demoStore(),
      reviews: reviewStore(path.join(dir, "reviews")),
      settingsFile: path.join(dir, "settings.json"),
      opts: { every: 5 },
      review: jest.fn(),
      cases: caseStore(path.join(dir, "cases")),
      log,
    });
    await dashboard.refresh();
  });
  afterEach(() => {
    dashboard.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const api = (key, body, ctx) => dashboard.api[key](body ?? {}, ctx);

  it("acts only when what it acts on is typed back, and logs it", async () => {
    await expect(
      api("POST /api/data/action", {
        action: "remove-list",
        code: "WCS2026A",
        confirm: "nope",
      }),
    ).rejects.toThrow(/Type WCS2026A/);
    await api(
      "POST /api/data/action",
      {
        action: "remove-list",
        code: "WCS2026A",
        confirm: "WCS2026A",
        reason: "child safety",
      },
      { device: "pixel" },
    );
    expect(
      (await api("POST /api/data/list", { code: "WCS2026A" })).status,
    ).toBe("taken-down");
    expect(log.recent()[0]).toMatchObject({
      action: "remove-list",
      shareCode: "WCS2026A",
      reason: "child safety",
      device: "pixel",
    });
    await api("POST /api/data/action", {
      action: "release",
      code: "WCS2026A",
      confirm: "WCS2026A",
    });
    expect(
      (await api("POST /api/data/registry")).takedowns.map((t) => t.code),
    ).toEqual(["OLDLIST1"]);
  });

  it("removes a user with their lists only when asked to", async () => {
    await expect(
      api("POST /api/data/action", {
        action: "remove-user",
        uid: PUBLISHER,
        confirm: PUBLISHER,
      }),
    ).rejects.toThrow(/with their lists/);
    await api("POST /api/data/action", {
      action: "remove-user",
      uid: PUBLISHER,
      withLists: true,
      confirm: PUBLISHER,
    });
    const u = await api("POST /api/data/user", { uid: PUBLISHER });
    expect(u.account).toBeNull();
    expect(
      (await api("POST /api/data/list", { code: "WCS2026A" })).status,
    ).toBe("taken-down");
  });

  it("blocks, lists and unblocks", async () => {
    await api("POST /api/data/action", {
      action: "block-user",
      uid: STUDENT,
      confirm: STUDENT,
    });
    const { blocks } = await api("POST /api/data/registry");
    expect(blocks.map((b) => b.uid)).toContain(STUDENT);
    await api("POST /api/data/action", {
      action: "unblock-user",
      uid: STUDENT,
      confirm: STUDENT,
    });
    expect(
      (await api("POST /api/data/user", { uid: STUDENT })).blockedSince,
    ).toBeNull();
  });

  it("deletes one suggestion", async () => {
    await api("POST /api/data/action", {
      action: "remove-suggestion",
      code: "WCS2026A",
      suggestionId: "s1",
      confirm: "s1",
    });
    expect(
      (await api("POST /api/data/list", { code: "WCS2026A" })).suggestions,
    ).toEqual([]);
  });

  it("refuses odd input", async () => {
    await expect(
      api("POST /api/data/list", { code: "../../x" }),
    ).rejects.toThrow(/share code/);
    await expect(api("POST /api/data/user", { uid: "a b" })).rejects.toThrow(
      /user id/,
    );
    await expect(api("POST /api/data/search", { query: "x" })).rejects.toThrow(
      /2 characters/,
    );
    await expect(
      api("POST /api/data/plan", { action: "drop-database" }),
    ).rejects.toThrow(/Unknown action/);
  });

  it("tracks an erasure request and forgets it when closed", async () => {
    const c = await api("POST /api/cases/open", {
      from: "jonas@example.com",
      message: "Please delete my data.",
    });
    await api("POST /api/cases/update", {
      id: c.id,
      addTarget: { type: "user", id: STUDENT },
      note: "found him",
    });
    await api("POST /api/data/action", {
      action: "remove-user",
      uid: STUDENT,
      confirm: STUDENT,
      caseId: c.id,
    });
    let [open] = (await api("GET /api/cases")).cases;
    expect(open).toMatchObject({
      stage: "acted",
      note: "found him",
      targets: [{ type: "user", id: STUDENT }],
    });
    expect(open.done[0]).toMatchObject({
      action: "remove-user",
      target: STUDENT,
    });
    await api("POST /api/cases/mark-sent", { id: c.id });
    [open] = (await api("GET /api/cases")).cases;
    expect(open.stage).toBe("replied");
    expect(() =>
      api("POST /api/cases/close", { id: c.id, confirm: "nope" }),
    ).toThrow(/Type/);
    api("POST /api/cases/close", { id: c.id, confirm: c.id });
    expect((await api("GET /api/cases")).cases).toEqual([]);
    // The log keeps what was done, not who asked.
    const text = fs.readFileSync(path.join(dir, "actions.jsonl"), "utf8");
    expect(text).toMatch(/remove-user/);
    expect(text).not.toMatch(/jonas@example\.com|Please delete/);
  });
});

describe("actionLog", () => {
  it("keeps only known fields and drops lines older than two years", () => {
    const dir = tmp();
    const log = actionLog(path.join(dir, "a.jsonl"));
    log.append({ action: "block-user", uid: "u1", email: "x@example.com" });
    expect(log.recent()[0]).not.toHaveProperty("email");
    fs.appendFileSync(
      log.file,
      `${JSON.stringify({ at: "2020-01-01T00:00:00.000Z", action: "old" })}\n`,
    );
    expect(log.prune()).toBe(1);
    expect(log.recent().map((e) => e.action)).toEqual(["block-user"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe("access", () => {
  const rpId = "dpm-ops.test";
  const origin = "https://dpm-ops.test:4777";
  let dir;
  let now;
  let access;
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const sha = (d) => crypto.createHash("sha256").update(d).digest();

  beforeEach(() => {
    dir = tmp();
    now = 1_000_000;
    fs.writeFileSync(
      path.join(dir, "devices.json"),
      JSON.stringify([
        { name: "pixel", fingerprint256: "AA" },
        { name: "old", fingerprint256: "BB", revokedAt: "2026-01-01" },
      ]),
    );
    fs.writeFileSync(
      path.join(dir, "enroll.json"),
      JSON.stringify({
        hash: sha("ABCD2345").toString("hex"),
        expires: now + 60_000,
      }),
    );
    access = createAccess({ dir, rpId, origin, clock: () => now });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const socket = (fp, authorized = true) => ({
    authorized,
    getPeerCertificate: () => ({ fingerprint256: fp }),
  });

  it("lets in listed devices only", () => {
    expect(access.deviceOf(socket("AA"))).toBe("pixel");
    expect(() => access.deviceOf(socket("BB"))).toThrow(/revoked/);
    expect(() => access.deviceOf(socket("AA", false))).toThrow(/certificate/);
  });

  /** A software authenticator: one EC key, signing like a phone would. */
  function authenticator() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const id = b64u(crypto.randomBytes(16));
    let count = 0;
    const clientData = (type, challenge, o = origin) =>
      Buffer.from(JSON.stringify({ type, challenge, origin: o }));
    return {
      register(opts) {
        return {
          id,
          publicKey: b64u(publicKey.export({ format: "der", type: "spki" })),
          alg: -7,
          clientDataJSON: b64u(clientData("webauthn.create", opts.challenge)),
        };
      },
      sign(opts, { flags = 0x05, o, rp = rpId } = {}) {
        count++;
        const auth = Buffer.alloc(37);
        sha(rp).copy(auth, 0);
        auth[32] = flags;
        auth.writeUInt32BE(count, 33);
        const cd = clientData("webauthn.get", opts.challenge, o);
        const signature = crypto.sign(
          "sha256",
          Buffer.concat([auth, sha(cd)]),
          privateKey,
        );
        return {
          id,
          clientDataJSON: b64u(cd),
          authenticatorData: b64u(auth),
          signature: b64u(signature),
        };
      },
    };
  }

  it("registers a passkey with a one-time code and arms the device for ten minutes", () => {
    expect(() => access.registerOptions("pixel", "WRONG")).toThrow(/code/);
    const key = authenticator();
    access.register(
      "pixel",
      key.register(access.registerOptions("pixel", "abcd2345")),
    );
    // The code is used up.
    expect(() => access.registerOptions("pixel", "ABCD2345")).toThrow(/code/);
    expect(() => access.requireArmed("pixel")).toThrow(/passkey/);
    const status = access.assert(
      "pixel",
      key.sign(access.assertOptions("pixel")),
    );
    expect(status).toMatchObject({ device: "pixel", passkeys: 1 });
    expect(status.armedUntil).toBeTruthy();
    access.requireArmed("pixel");
    now += 11 * 60 * 1000;
    expect(() => access.requireArmed("pixel")).toThrow(/passkey/);
  });

  it("refuses a wrong origin, site, missing verification or replayed challenge", () => {
    const key = authenticator();
    access.register(
      "pixel",
      key.register(access.registerOptions("pixel", "ABCD2345")),
    );
    expect(() =>
      access.assert(
        "pixel",
        key.sign(access.assertOptions("pixel"), { o: "https://evil.test" }),
      ),
    ).toThrow(/Open the dashboard/);
    expect(() =>
      access.assert(
        "pixel",
        key.sign(access.assertOptions("pixel"), { rp: "evil.test" }),
      ),
    ).toThrow(/another site/);
    expect(() =>
      access.assert(
        "pixel",
        key.sign(access.assertOptions("pixel"), { flags: 0x01 }),
      ),
    ).toThrow(/verify/);
    const opts = access.assertOptions("pixel");
    access.assert("pixel", key.sign(opts));
    expect(() => access.assert("pixel", key.sign(opts))).toThrow(
      /doesn't match/,
    );
    // Another device can't use this device's passkey.
    expect(() =>
      access.assert("laptop", key.sign(access.assertOptions("pixel"))),
    ).toThrow(/Unknown passkey/);
  });
});

const hasOpenssl = (() => {
  try {
    execFileSync("openssl", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

(hasOpenssl ? describe : describe.skip)("pki", () => {
  it("makes a CA, a server certificate and device certificates the server lets in", async () => {
    const https = require("https");
    const { main } = require("@/tools/dashboard/pki");
    const { createServer } = require("@/tools/dashboard/server");
    const root = tmp();
    const out = jest.spyOn(console, "log").mockImplementation(() => {});
    main(["init", "--name", "dpm-ops.test", "--ip", "127.0.0.1"], root);
    main(["add-device", "pixel"], root);
    const password = out.mock.calls
      .flat()
      .join("\n")
      .match(/password (\S+)/)[1];
    out.mockRestore();
    const tls = (f) => fs.readFileSync(path.join(root, "tls", f));
    const access = createAccess({
      dir: path.join(root, "access"),
      rpId: "dpm-ops.test",
      origin: "https://dpm-ops.test",
    });
    const server = createServer(
      { api: { "GET /api/ping": (_, { device }) => ({ device }) } },
      {
        port: 0,
        token: "t".repeat(48),
        hosts: ["dpm-ops.test"],
        tls: {
          key: tls("server.key"),
          cert: tls("server.crt"),
          ca: tls("ca.crt"),
        },
        access,
      },
    );
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();
    const get = (withCert) =>
      new Promise((resolve) => {
        https
          .get(
            {
              host: "127.0.0.1",
              port,
              servername: "dpm-ops.test",
              path: "/api/ping",
              ca: tls("ca.crt"),
              headers: { Host: "dpm-ops.test", "X-Dpm-Token": "t".repeat(48) },
              ...(withCert && {
                pfx: tls("devices/pixel.p12"),
                passphrase: password,
              }),
            },
            (res) => {
              let body = "";
              res.on("data", (d) => (body += d));
              res.on("end", () => resolve([res.statusCode, body]));
            },
          )
          .on("error", (e) => resolve(["error", e.code]));
      });
    expect(await get(true)).toEqual([200, JSON.stringify({ device: "pixel" })]);
    expect((await get(false))[0]).toBe("error");
    main(["revoke-device", "pixel"], root);
    expect((await get(true))[0]).toBe(403);
    await new Promise((r) => server.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
