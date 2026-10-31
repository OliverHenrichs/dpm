/**
 * Who may use the dashboard when it serves the home network (on a home
 * server, `--lan` or `--proxy`): only someone who signs in with one of the
 * operator's passkeys. Signing in starts a session (a cookie the page can't
 * read); every page and API call but the sign-in itself needs one. Every
 * action that deletes or blocks (and the erasure requests and settings)
 * also needs the passkey again within the last ten minutes.
 *
 * A device is a name (laptop, pixel) that owns passkeys. It is made by
 * enrolling: `npm run ops:pki -- enroll-code <name>` on the server gives a
 * one-time code, typed on the sign-in page of that device, which then
 * registers a passkey. `revoke-device <name>` removes its passkeys and ends
 * its sessions from their next request.
 *
 * Passkeys are WebAuthn credentials. The browser hands over the public key
 * at registration (`getPublicKey()`, SPKI), so checking a signature needs
 * only Node's crypto, no CBOR and no library.
 *
 * State lives in `<dir>`: devices.json, passkeys.json, enroll.json (all
 * written here or by pki.js). Sessions live in memory: a restart signs
 * everyone out.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { httpError, now, readJson, writeJson } = require("./http");

const ARMED_MS = 10 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;
const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;
/** Failed sign-ins or enrolments (from anywhere) before those pause. */
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 10 * 60 * 1000;
/** Wrong guesses before an enrolment code is void. */
const MAX_CODE_TRIES = 5;
const COOKIE = "__Host-dpm-session";
/** COSE algorithm ids the browser may pick: ES256, EdDSA, RS256. */
const ALGORITHMS = [-7, -8, -257];
const DEVICE_NAME = /^[a-z0-9][a-z0-9-]{0,31}$/;

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(String(s ?? ""), "base64url");
const sha256 = (data) => crypto.createHash("sha256").update(data).digest();

function hashCode(code) {
  return sha256(String(code).trim().toUpperCase()).toString("hex");
}

/** The device list: [{ name, addedAt, revokedAt? }]. */
function readDevices(dir) {
  return readJson(path.join(dir, "devices.json")) ?? [];
}

function isActive(dir, name) {
  return readDevices(dir).some((d) => d.name === name && !d.revokedAt);
}

/** The session cookie's value from a Cookie header, if any. */
function cookieValue(header) {
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE) {
      return part.slice(i + 1).trim();
    }
  }
  return null;
}

/**
 * @param {{ dir: string, rpId: string, origin: string, clock?: () => number,
 *   idleMs?: number, maxMs?: number }} opts
 *   rpId is the dashboard's host name (passkeys are bound to it), origin its
 *   https URL as the browser shows it.
 */
function createAccess({
  dir,
  rpId,
  origin,
  clock = Date.now,
  idleMs = SESSION_IDLE_MS,
  maxMs = SESSION_MAX_MS,
}) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const passkeyFile = path.join(dir, "passkeys.json");
  const enrollFile = path.join(dir, "enroll.json");
  const devicesFile = path.join(dir, "devices.json");
  const challenges = new Map();
  /** sha256(cookie) → { device, token, created, seen, armedUntil } */
  const sessions = new Map();
  let failures = [];

  const passkeys = () => readJson(passkeyFile) ?? [];

  function challenge(purpose, device) {
    for (const [c, v] of challenges) {
      if (v.expires < clock()) challenges.delete(c);
    }
    const c = b64u(crypto.randomBytes(32));
    challenges.set(c, { purpose, device, expires: clock() + CHALLENGE_MS });
    return c;
  }

  /** Checks clientDataJSON, uses up its challenge and returns what it was for. */
  function checkClientData(clientDataJSON, type, purpose, device) {
    let client;
    try {
      client = JSON.parse(fromB64u(clientDataJSON).toString("utf8"));
    } catch {
      throw httpError(400, "Unreadable passkey answer.");
    }
    const pending = challenges.get(client.challenge);
    challenges.delete(client.challenge);
    if (
      client.type !== type ||
      !pending ||
      pending.purpose !== purpose ||
      (device !== undefined && pending.device !== device) ||
      pending.expires < clock()
    ) {
      throw httpError(
        400,
        "The passkey answer doesn't match this request. Try again.",
      );
    }
    if (client.origin !== origin) {
      throw httpError(400, `Open the dashboard at ${origin} to use passkeys.`);
    }
    return pending;
  }

  /** Checks a passkey signature for `key` and stores its counter. */
  function verify(list, key, { clientDataJSON, authenticatorData, signature }) {
    const auth = fromB64u(authenticatorData);
    if (auth.length < 37 || !auth.subarray(0, 32).equals(sha256(rpId))) {
      throw httpError(403, "The passkey is for another site.");
    }
    const flags = auth[32];
    // User present and user verified (fingerprint, PIN).
    if ((flags & 0x01) === 0 || (flags & 0x04) === 0) {
      throw httpError(403, "The passkey didn't verify you.");
    }
    const signed = Buffer.concat([auth, sha256(fromB64u(clientDataJSON))]);
    const publicKey = crypto.createPublicKey({
      key: fromB64u(key.publicKey),
      format: "der",
      type: "spki",
    });
    const ok = crypto.verify(
      key.alg === -8 ? null : "sha256",
      signed,
      publicKey,
      fromB64u(signature),
    );
    if (!ok) throw httpError(403, "Passkey signature doesn't match.");
    const count = auth.readUInt32BE(33);
    // A counter that goes backwards means a cloned authenticator. Synced
    // passkeys always report 0, which is fine.
    if (count !== 0 && count <= key.signCount) {
      throw httpError(
        403,
        "Passkey counter went backwards; remove and re-register it.",
      );
    }
    key.signCount = count;
    key.lastUsedAt = now();
    writeJson(passkeyFile, list);
  }

  /**
   * Runs a sign-in or enrolment step. While too many have failed lately
   * (from anywhere: behind a proxy there is no client address to go by),
   * refuses them all for a while.
   */
  function guarded(fn) {
    const t = clock();
    failures = failures.filter((f) => f > t - FAILURE_WINDOW_MS);
    if (failures.length >= MAX_FAILURES) {
      throw httpError(
        429,
        "Too many failed sign-ins. Wait ten minutes and try again.",
      );
    }
    try {
      return fn();
    } catch (e) {
      if ((e.status ?? 500) < 500) failures.push(clock());
      throw e;
    }
  }

  /** Starts a session, armed, and returns the cookie value. */
  function startSession(device) {
    const cookie = b64u(crypto.randomBytes(32));
    const t = clock();
    sessions.set(sha256(cookie).toString("hex"), {
      device,
      token: crypto.randomBytes(24).toString("hex"),
      created: t,
      seen: t,
      armedUntil: t + ARMED_MS,
    });
    return cookie;
  }

  function status(session) {
    const until = session.armedUntil;
    return {
      device: session.device,
      passkeys: passkeys().filter((p) => p.device === session.device).length,
      armedUntil: until > clock() ? new Date(until).toISOString() : null,
    };
  }

  return {
    rpId,
    origin,
    cookieName: COOKIE,
    sessionMaxSeconds: Math.floor(maxMs / 1000),

    /**
     * The session a request's Cookie header carries, or null. Ends one that
     * idled too long, is too old, or whose device was revoked.
     */
    sessionOf(cookieHeader) {
      const value = cookieValue(cookieHeader);
      if (!value) return null;
      const id = sha256(value).toString("hex");
      const s = sessions.get(id);
      if (!s) return null;
      const t = clock();
      if (
        t - s.seen > idleMs ||
        t - s.created > maxMs ||
        !isActive(dir, s.device)
      ) {
        sessions.delete(id);
        return null;
      }
      s.seen = t;
      return Object.assign(s, { id });
    },

    status,

    /** Whether this session used its passkey in the last ten minutes. */
    isArmed(session) {
      return session.armedUntil > clock();
    },

    /**
     * Throws 428 unless this session used its passkey in the last ten
     * minutes. Only the passkey arms it, so a busy session is still asked again.
     */
    requireArmed(session) {
      if (!this.isArmed(session)) {
        throw httpError(428, "Confirm with your passkey first.");
      }
    },

    disarm(session) {
      session.armedUntil = 0;
    },

    signOut(session) {
      sessions.delete(session.id);
    },

    /* --- signing in: no session yet --- */

    /** Options for the browser's passkey prompt, with no user named. */
    loginOptions() {
      return guarded(() => ({
        challenge: challenge("login", null),
        rpId,
        allowCredentials: [],
        userVerification: "required",
      }));
    },

    /** Checks a passkey; returns a new session's cookie value. */
    login(body) {
      return guarded(() => {
        checkClientData(body.clientDataJSON, "webauthn.get", "login", null);
        const list = passkeys();
        const key = list.find((p) => p.id === body.id);
        if (!key || !isActive(dir, key.device)) {
          throw httpError(403, "Unknown passkey. Enrol this device first.");
        }
        verify(list, key, body);
        return { cookie: startSession(key.device), device: key.device };
      });
    },

    /** Starts registering a passkey; needs a fresh code from pki.js. */
    enrollOptions(code) {
      return guarded(() => {
        const enroll = readJson(enrollFile);
        if (!enroll || enroll.expires < clock()) {
          throw httpError(
            403,
            "No valid code. Make one on the server: npm run ops:pki -- enroll-code <device>",
          );
        }
        if (enroll.hash !== hashCode(code ?? "")) {
          enroll.tries = (enroll.tries ?? 0) + 1;
          if (enroll.tries >= MAX_CODE_TRIES) fs.rmSync(enrollFile);
          else writeJson(enrollFile, enroll);
          throw httpError(403, "Wrong code.");
        }
        const device = enroll.device;
        return {
          challenge: challenge("register", device),
          rp: { id: rpId, name: "DPM Operations" },
          user: {
            id: b64u(sha256(device).subarray(0, 16)),
            name: device,
            displayName: `DPM operator (${device})`,
          },
          pubKeyCredParams: ALGORITHMS.map((alg) => ({
            type: "public-key",
            alg,
          })),
          excludeCredentials: passkeys()
            .filter((p) => p.device === device)
            .map((p) => ({ type: "public-key", id: p.id })),
        };
      });
    },

    /**
     * Stores the new passkey (the browser sends its public key as SPKI),
     * adds the device and returns a new session's cookie value.
     */
    enroll({ id, publicKey, alg, clientDataJSON }) {
      return guarded(() => {
        const { device } = checkClientData(
          clientDataJSON,
          "webauthn.create",
          "register",
        );
        if (!ALGORITHMS.includes(alg))
          throw httpError(400, "Unsupported passkey type.");
        try {
          crypto.createPublicKey({
            key: fromB64u(publicKey),
            format: "der",
            type: "spki",
          });
        } catch {
          throw httpError(400, "Unreadable public key.");
        }
        fs.rmSync(enrollFile, { force: true });
        if (passkeys().some((p) => p.id === id && p.device !== device)) {
          throw httpError(409, "Another device already has this passkey.");
        }
        const list = passkeys().filter((p) => p.id !== id);
        list.push({ id, device, publicKey, alg, signCount: 0, addedAt: now() });
        writeJson(passkeyFile, list);
        if (!isActive(dir, device)) {
          writeJson(devicesFile, [
            ...readDevices(dir),
            { name: device, addedAt: now() },
          ]);
        }
        return { cookie: startSession(device), device };
      });
    },

    /* --- the passkey again, for what deletes or blocks --- */

    assertOptions(session) {
      const mine = passkeys().filter((p) => p.device === session.device);
      if (mine.length === 0) {
        throw httpError(400, "This device has no passkey any more.");
      }
      return {
        challenge: challenge("assert", session.device),
        rpId,
        allowCredentials: mine.map((p) => ({ type: "public-key", id: p.id })),
        userVerification: "required",
      };
    },

    /** Checks a passkey signature and arms the session for ten minutes. */
    assert(session, body) {
      const list = passkeys();
      const key = list.find(
        (p) => p.id === body.id && p.device === session.device,
      );
      if (!key) throw httpError(403, "Unknown passkey for this device.");
      checkClientData(
        body.clientDataJSON,
        "webauthn.get",
        "assert",
        session.device,
      );
      verify(list, key, body);
      session.armedUntil = clock() + ARMED_MS;
      return status(session);
    },
  };
}

module.exports = {
  createAccess,
  hashCode,
  readDevices,
  cookieValue,
  ARMED_MS,
  DEVICE_NAME,
  SESSION_IDLE_MS,
  SESSION_MAX_MS,
};
