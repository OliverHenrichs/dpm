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
  let store;
  beforeEach(async () => {
    dir = tmp();
    log = actionLog(path.join(dir, "actions.jsonl"));
    store = demoStore();
    dashboard = createDashboard({
      store,
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
      { device: "phone" },
    );
    expect(
      (await api("POST /api/data/list", { code: "WCS2026A" })).status,
    ).toBe("taken-down");
    expect(log.recent()[0]).toMatchObject({
      action: "remove-list",
      shareCode: "WCS2026A",
      reason: "child safety",
      device: "phone",
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

  it("logs a start and an end, and the owner a takedown overwrites", async () => {
    await api("POST /api/data/action", {
      action: "remove-list",
      code: "WCS2026A",
      confirm: "WCS2026A",
    });
    const [done, started] = log.recent();
    expect(started).toMatchObject({ status: "started", uid: PUBLISHER });
    expect(done).toMatchObject({
      action: "remove-list",
      status: "done",
      uid: PUBLISHER,
    });
  });

  it("logs a removal that fails, on the request too", async () => {
    const c = await api("POST /api/cases/open", { message: "delete me" });
    store.removeList = async () => {
      throw new Error("deadline exceeded");
    };
    await expect(
      api("POST /api/data/action", {
        action: "remove-list",
        code: "WCS2026A",
        confirm: "WCS2026A",
        caseId: c.id,
      }),
    ).rejects.toThrow(/deadline/);
    expect(log.recent()[0]).toMatchObject({ status: "failed" });
    expect(
      (await api("GET /api/cases")).cases[0].done.map((d) => d.action),
    ).toEqual(["remove-list (failed)"]);
  });

  it("keeps reasons short", async () => {
    await expect(
      api("POST /api/data/action", {
        action: "remove-list",
        code: "WCS2026A",
        confirm: "WCS2026A",
        reason: "x".repeat(201),
      }),
    ).rejects.toThrow(/200 characters/);
    expect(log.recent()).toEqual([]);
  });

  it("keeps erasure requests locked until the passkey was used", async () => {
    await api("POST /api/cases/open", { message: "delete me" });
    expect(await api("GET /api/cases", {}, { armed: false })).toEqual({
      cases: [],
      locked: true,
    });
    expect(
      (await api("GET /api/cases", {}, { armed: true })).cases,
    ).toHaveLength(1);
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
  const rpId = "ops.test";
  const origin = "https://ops.test";
  let dir;
  let now;
  let access;
  const b64u = (b) => Buffer.from(b).toString("base64url");
  const sha = (d) => crypto.createHash("sha256").update(d).digest();
  const code = (device, c = "ABCD2345XY", tries = 0) =>
    fs.writeFileSync(
      path.join(dir, "enroll.json"),
      JSON.stringify({
        hash: sha(c).toString("hex"),
        device,
        tries,
        expires: now + 60_000,
      }),
    );
  const cookieOf = ({ cookie }) => `${access.cookieName}=${cookie}`;

  beforeEach(() => {
    dir = tmp();
    now = 1_000_000;
    access = createAccess({ dir, rpId, origin, clock: () => now });
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

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
      id,
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

  /** Enrols `device` with a fresh code; returns its authenticator and first session. */
  function enrol(device) {
    code(device);
    const key = authenticator();
    const result = access.enroll(
      key.register(access.enrollOptions("abcd2345xy")),
    );
    return { key, result, session: access.sessionOf(cookieOf(result)) };
  }

  it("enrols a device with a one-time code and signs it in, armed", () => {
    code("phone");
    expect(() => access.enrollOptions("WRONG")).toThrow(/Wrong code/);
    const { result, session } = enrol("phone");
    expect(result.device).toBe("phone");
    expect(session.device).toBe("phone");
    expect(access.isArmed(session)).toBe(true);
    // The code is used up, and the device is listed.
    expect(() => access.enrollOptions("ABCD2345XY")).toThrow(/No valid code/);
    expect(
      JSON.parse(fs.readFileSync(path.join(dir, "devices.json"), "utf8")),
    ).toEqual([expect.objectContaining({ name: "phone" })]);
  });

  it("voids a code after five wrong tries", () => {
    code("phone", "ABCD2345XY", 4);
    expect(() => access.enrollOptions("WRONG")).toThrow(/Wrong code/);
    expect(() => access.enrollOptions("ABCD2345XY")).toThrow(/No valid code/);
  });

  it("signs in with a discoverable passkey and ends sessions that idle, age or are revoked", () => {
    const { key } = enrol("phone");
    const opts = access.loginOptions();
    expect(opts.allowCredentials).toEqual([]);
    const login = access.login(key.sign(opts));
    expect(login.device).toBe("phone");
    const cookie = cookieOf(login);
    expect(access.sessionOf(cookie)).not.toBeNull();
    expect(access.sessionOf(`${access.cookieName}=forged`)).toBeNull();
    expect(access.sessionOf(undefined)).toBeNull();
    // Idle for more than twelve hours.
    now += 13 * 60 * 60 * 1000;
    expect(access.sessionOf(cookie)).toBeNull();
    // Older than seven days, however busy.
    const busy = cookieOf(access.login(key.sign(access.loginOptions())));
    for (let i = 0; i < 16; i++) {
      now += 11 * 60 * 60 * 1000;
      access.sessionOf(busy);
    }
    expect(access.sessionOf(busy)).toBeNull();
    // Revoked (pki.js marks it): the session ends and signing in fails.
    const last = cookieOf(access.login(key.sign(access.loginOptions())));
    const { main } = require("@/tools/dashboard/pki");
    const out = jest.spyOn(console, "log").mockImplementation(() => {});
    main(["revoke-device", "phone"], path.dirname(dir) && dirRoot(dir));
    out.mockRestore();
    expect(access.sessionOf(last)).toBeNull();
    expect(() => access.login(key.sign(access.loginOptions()))).toThrow(
      /Unknown passkey/,
    );
  });

  it("asks for the passkey again ten minutes after its last use", () => {
    const { key, session } = enrol("phone");
    access.requireArmed(session);
    now += 11 * 60 * 1000;
    expect(() => access.requireArmed(session)).toThrow(/passkey/);
    const status = access.assert(
      session,
      key.sign(access.assertOptions(session)),
    );
    expect(status).toMatchObject({ device: "phone", passkeys: 1 });
    access.requireArmed(session);
    access.disarm(session);
    expect(() => access.requireArmed(session)).toThrow(/passkey/);
  });

  it("refuses another device's passkey id", () => {
    const { key } = enrol("phone");
    code("computer");
    const again = key.register(access.enrollOptions("ABCD2345XY"));
    expect(() => access.enroll(again)).toThrow(/Another device/);
    const other = enrol("computer").session;
    expect(() =>
      access.assert(other, key.sign(access.assertOptions(other))),
    ).toThrow(/Unknown passkey/);
  });

  it("refuses a wrong origin, site, missing verification or replayed challenge", () => {
    const { key } = enrol("phone");
    expect(() =>
      access.login(key.sign(access.loginOptions(), { o: "https://evil.test" })),
    ).toThrow(/Open the dashboard/);
    expect(() =>
      access.login(key.sign(access.loginOptions(), { rp: "evil.test" })),
    ).toThrow(/another site/);
    expect(() =>
      access.login(key.sign(access.loginOptions(), { flags: 0x01 })),
    ).toThrow(/verify/);
    const opts = access.loginOptions();
    access.login(key.sign(opts));
    expect(() => access.login(key.sign(opts))).toThrow(/doesn't match/);
  });

  it("pauses sign-in after ten failures in ten minutes", () => {
    for (let i = 0; i < 10; i++) {
      expect(() => access.enrollOptions("nope")).toThrow(/code/);
    }
    expect(() => access.loginOptions()).toThrow(/Too many/);
    now += 11 * 60 * 1000;
    expect(access.loginOptions().challenge).toBeTruthy();
  });
});

/** createAccess is given <root>/access; pki.js takes <root>. */
function dirRoot(accessDir) {
  const root = tmp();
  fs.rmSync(path.join(root), { recursive: true, force: true });
  fs.mkdirSync(root);
  fs.symlinkSync(accessDir, path.join(root, "access"));
  return root;
}

describe("home server", () => {
  const http = require("http");
  const { main } = require("@/tools/dashboard/pki");
  const { createServer } = require("@/tools/dashboard/server");
  const ORIGIN = "https://ops.test";
  let root;
  let server;
  let port;
  let now;
  let access;

  beforeEach(async () => {
    root = tmp();
    now = 1_000_000;
    access = createAccess({
      dir: path.join(root, "access"),
      rpId: "ops.test",
      origin: ORIGIN,
      clock: () => now,
    });
    server = createServer(
      {
        api: {
          "GET /api/ping": (_, { device }) => ({ device }),
          "POST /api/settings": () => ({ ok: true }),
        },
      },
      { port: 0, hosts: ["ops.test"], access },
    );
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    port = server.address().port;
  });
  afterEach(async () => {
    await new Promise((r) => server.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  });

  const req = (method, p, { headers = {}, body } = {}) =>
    new Promise((resolve) => {
      const r = http.request(
        {
          host: "127.0.0.1",
          port,
          method,
          path: p,
          headers: {
            Host: "ops.test",
            ...(method === "POST" && {
              Origin: ORIGIN,
              "Content-Type": "application/json",
            }),
            ...headers,
          },
        },
        (res) => {
          let text = "";
          res.on("data", (d) => (text += d));
          res.on("end", () =>
            resolve({ status: res.statusCode, headers: res.headers, text }),
          );
        },
      );
      r.end(body ? JSON.stringify(body) : undefined);
    });

  it("shows only the sign-in page until a passkey signs in, then the dashboard with that session's token", async () => {
    const page = await req("GET", "/");
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/Sign in with passkey/);
    expect(page.text).not.toMatch(/dpm-token/);
    expect((await req("GET", "/api/ping")).status).toBe(401);
    expect(
      (await req("GET", "/api/ping", { headers: { Host: "evil.test" } }))
        .status,
    ).toBe(403);
    expect(
      (
        await req("POST", "/api/access/login-options", {
          headers: { Origin: "https://evil.test" },
        })
      ).status,
    ).toBe(403);

    // Enrol "phone" with a code from pki.js.
    const out = jest.spyOn(console, "log").mockImplementation(() => {});
    expect(() => main(["enroll-code", "Bad Name"], root)).toThrow(
      /device name/,
    );
    main(["enroll-code", "phone"], root);
    const c = out.mock.calls
      .flat()
      .join("\n")
      .match(/Code for phone: (\S+)/)[1];
    out.mockRestore();
    const opts = JSON.parse(
      (await req("POST", "/api/access/enroll-options", { body: { code: c } }))
        .text,
    );
    expect(opts.user.name).toBe("phone");
    const { publicKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const b64u = (b) => Buffer.from(b).toString("base64url");
    const enrolled = await req("POST", "/api/access/enroll", {
      body: {
        id: "key1",
        publicKey: b64u(publicKey.export({ format: "der", type: "spki" })),
        alg: -7,
        clientDataJSON: b64u(
          JSON.stringify({
            type: "webauthn.create",
            challenge: opts.challenge,
            origin: ORIGIN,
          }),
        ),
      },
    });
    expect(enrolled.status).toBe(200);
    const setCookie = enrolled.headers["set-cookie"][0];
    expect(setCookie).toMatch(
      /^__Host-dpm-session=[\w-]+; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=604800$/,
    );
    const cookie = setCookie.split(";")[0];

    const signedIn = await req("GET", "/", { headers: { Cookie: cookie } });
    const token = signedIn.text.match(/name="dpm-token" content="(\w+)"/)[1];
    const auth = { Cookie: cookie, "X-Dpm-Token": token };
    expect(
      (await req("GET", "/api/ping", { headers: { Cookie: cookie } })).status,
    ).toBe(401);
    expect(
      JSON.parse((await req("GET", "/api/ping", { headers: auth })).text),
    ).toEqual({ device: "phone" });
    expect(
      (await req("POST", "/api/settings", { headers: auth, body: {} })).status,
    ).toBe(200);
    // Ten minutes on, settings need the passkey again.
    now += 11 * 60 * 1000;
    expect(
      (await req("POST", "/api/settings", { headers: auth, body: {} })).status,
    ).toBe(428);
    expect(
      JSON.parse((await req("GET", "/api/access", { headers: auth })).text),
    ).toMatchObject({
      mode: "lan",
      device: "phone",
      passkeys: 1,
      armedUntil: null,
    });

    // Signing out ends the session.
    const out2 = await req("POST", "/api/access/sign-out", { headers: auth });
    expect(out2.headers["set-cookie"][0]).toMatch(/Max-Age=0/);
    expect((await req("GET", "/api/ping", { headers: auth })).status).toBe(401);
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
  it("makes a server certificate for --lan that serves HTTPS", async () => {
    const https = require("https");
    const { main } = require("@/tools/dashboard/pki");
    const { createServer } = require("@/tools/dashboard/server");
    const root = tmp();
    const out = jest.spyOn(console, "log").mockImplementation(() => {});
    main(["init", "--name", "ops-host.test", "--ip", "127.0.0.1"], root);
    out.mockRestore();
    expect(() => main(["init", "--name", "ops-host.test"], root)).toThrow(
      /already has a CA/,
    );
    const tls = (f) => fs.readFileSync(path.join(root, "tls", f));
    const access = createAccess({
      dir: path.join(root, "access"),
      rpId: "ops-host.test",
      origin: "https://ops-host.test",
    });
    const server = createServer(
      { api: {} },
      {
        port: 0,
        hosts: ["ops-host.test"],
        tls: { key: tls("server.key"), cert: tls("server.crt") },
        access,
      },
    );
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address();
    const [status, body] = await new Promise((resolve) => {
      https
        .get(
          {
            host: "127.0.0.1",
            port,
            servername: "ops-host.test",
            path: "/",
            ca: tls("ca.crt"),
            headers: { Host: "ops-host.test" },
          },
          (res) => {
            let text = "";
            res.on("data", (d) => (text += d));
            res.on("end", () => resolve([res.statusCode, text]));
          },
        )
        .on("error", (e) => resolve(["error", e.code]));
    });
    expect(status).toBe(200);
    expect(body).toMatch(/Sign in with passkey/);
    await new Promise((r) => server.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  });
});
